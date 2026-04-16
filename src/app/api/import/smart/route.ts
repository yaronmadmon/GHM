import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import OpenAI from "openai";
import * as XLSX from "xlsx";
import Papa from "papaparse";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedTenant {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  propertyName?: string;
  propertyAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  unitNumber?: string;
  rentAmount?: number;
  depositAmount?: number;
  depositPaid?: boolean;
  leaseStart?: string;
  leaseEnd?: string;
  balance?: number;           // outstanding balance still owed
  notes?: string;
  paymentHistory?: Array<{
    date: string;
    amount: number;
    status: "paid" | "partial" | "overdue" | "pending";
    method?: string;
  }>;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") ?? "extract";

    // ── EXTRACT: parse file + ask Claude ──────────────────────────────────────
    if (action === "extract") {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) return Response.json({ error: "No file provided" }, { status: 400 });

      // Parse file to CSV text
      const buf = Buffer.from(await file.arrayBuffer());
      let csvText = "";

      if (file.name.endsWith(".csv")) {
        csvText = buf.toString("utf-8");
      } else {
        const wb = XLSX.read(buf, { type: "buffer" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        csvText = XLSX.utils.sheet_to_csv(ws);
      }

      // Truncate if very large (Claude context limit protection)
      const MAX_CHARS = 60_000;
      const truncated = csvText.length > MAX_CHARS;
      const content = truncated ? csvText.slice(0, MAX_CHARS) + "\n... [truncated]" : csvText;

      const message = await client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 4096,
        messages: [
          {
            role: "system",
            content: `You are a data extraction assistant for a property management app.
You will receive the raw content of a tenant ledger or roster exported from any property management platform (Buildium, AppFolio, Cozy, Rentec, spreadsheets, etc.).

Your job is to extract structured tenant records from this data and return ONLY valid JSON — no explanation, no markdown, no code blocks.

Return a JSON array where each element has this shape (omit fields you cannot find):
{
  "firstName": string,
  "lastName": string,
  "email": string,
  "phone": string,
  "propertyName": string,
  "propertyAddress": string,
  "city": string,
  "state": string,
  "zip": string,
  "unitNumber": string,
  "rentAmount": number,
  "depositAmount": number,
  "depositPaid": boolean,
  "leaseStart": "YYYY-MM-DD",
  "leaseEnd": "YYYY-MM-DD",
  "balance": number,
  "notes": string,
  "paymentHistory": [
    { "date": "YYYY-MM-DD", "amount": number, "status": "paid"|"partial"|"overdue"|"pending", "method": string }
  ]
}

Rules:
- firstName and lastName are required for every record. Split full names if needed.
- rentAmount, depositAmount, and balance must be plain numbers (strip $, commas).
- depositPaid: true if the deposit has been received, false or omit if not.
- balance: the total amount the tenant currently owes (outstanding balance). 0 if fully current.
- Dates must be YYYY-MM-DD format.
- If a field is missing or unclear, omit it entirely.
- Deduplicate: if the same tenant appears multiple times (multiple payment rows), merge into one record with paymentHistory.
- Return [] if no tenant data is found.`,
          },
          {
            role: "user",
            content: `Extract all tenant records from this file:\n\n${content}`,
          },
        ],
      });

      const rawText = message.choices[0].message.content ?? "[]";

      let extracted: ExtractedTenant[] = [];
      try {
        // Strip markdown code fences if Claude wrapped the JSON
        const cleaned = rawText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
        extracted = JSON.parse(cleaned);
        if (!Array.isArray(extracted)) extracted = [];
      } catch {
        return Response.json({ error: "AI could not parse the file. Try a CSV format." }, { status: 422 });
      }

      return Response.json({ extracted, truncated, totalRows: extracted.length });
    }

    // ── CHECK-CONFLICTS: which emails already exist in this org ───────────────
    if (action === "check-conflicts") {
      const body = await req.json();
      const emails: string[] = (body.emails ?? []).filter(Boolean);
      if (!emails.length) return Response.json({ existing: [] });
      const existing = await prisma.tenant.findMany({
        where: { organizationId, email: { in: emails } },
        select: { email: true },
      });
      return Response.json({ existing: existing.map((t) => t.email).filter(Boolean) });
    }

    // ── COMMIT: save extracted records to DB ──────────────────────────────────
    if (action === "commit") {
      const body = await req.json();
      const records: ExtractedTenant[] = body.records ?? [];
      const options: { createLeases: boolean; createPayments: boolean } = body.options ?? {
        createLeases: true,
        createPayments: true,
      };

      const results = {
        tenants: 0,
        properties: 0,
        leases: 0,
        payments: 0,
        skipped: 0,
        errors: [] as string[],
      };

      for (const rec of records) {
        if (!rec.firstName || !rec.lastName) { results.skipped++; continue; }

        try {
          // 1. Create or find tenant
          const existingTenant = rec.email
            ? await prisma.tenant.findFirst({ where: { organizationId, email: rec.email } })
            : null;

          const tenant = existingTenant ?? await prisma.tenant.create({
            data: {
              organizationId,
              firstName: rec.firstName.trim(),
              lastName: rec.lastName.trim(),
              email: rec.email?.trim() || null,
              phone: rec.phone?.trim() || null,
              notes: rec.notes?.trim() || null,
            },
          });
          if (!existingTenant) results.tenants++;

          // 2. Create property + unit + lease if we have enough info
          if (
            options.createLeases &&
            rec.propertyAddress &&
            rec.rentAmount &&
            rec.leaseStart
          ) {
            // Find or create property
            const propName = rec.propertyName?.trim() || rec.propertyAddress.trim();
            let property = await prisma.property.findFirst({
              where: {
                organizationId,
                OR: [
                  { name: propName },
                  { addressLine1: rec.propertyAddress.trim() },
                ],
              },
            });

            if (!property) {
              property = await prisma.property.create({
                data: {
                  organizationId,
                  name: propName,
                  addressLine1: rec.propertyAddress.trim(),
                  city: rec.city?.trim() || "",
                  state: rec.state?.trim() || "",
                  zip: rec.zip?.trim() || "",
                },
              });
              results.properties++;
            }

            // Find or create unit
            const unitNumber = rec.unitNumber?.trim() || "1";
            let unit = await prisma.unit.findFirst({
              where: { propertyId: property.id, unitNumber },
            });

            if (!unit) {
              unit = await prisma.unit.create({
                data: { propertyId: property.id, unitNumber },
              });
            }

            // Check for existing lease on this unit for this tenant
            const existingLease = await prisma.lease.findFirst({
              where: {
                organizationId,
                unitId: unit.id,
                tenants: { some: { tenantId: tenant.id } },
              },
            });

            if (!existingLease) {
              const lease = await prisma.lease.create({
                data: {
                  organizationId,
                  unitId: unit.id,
                  startDate: new Date(rec.leaseStart),
                  endDate: rec.leaseEnd ? new Date(rec.leaseEnd) : undefined,
                  rentAmount: rec.rentAmount,
                  depositAmount: rec.depositAmount ?? undefined,
                  depositPaid: rec.depositPaid ?? false,
                  depositPaidAt: rec.depositPaid ? new Date(rec.leaseStart) : undefined,
                  status: "active",
                  tenants: { create: [{ tenantId: tenant.id, isPrimary: true }] },
                },
              });
              results.leases++;

              // Update unit status
              await prisma.unit.update({ where: { id: unit.id }, data: { status: "occupied" } });

              if (options.createPayments) {
                // 3a. Import payment history records
                const coveredPeriods = new Set<string>();
                if (rec.paymentHistory?.length) {
                  for (const ph of rec.paymentHistory) {
                    const d = new Date(ph.date);
                    if (isNaN(d.getTime())) continue;
                    const year = d.getFullYear();
                    const month = d.getMonth() + 1;
                    await prisma.rentPayment.upsert({
                      where: {
                        leaseId_periodYear_periodMonth: {
                          leaseId: lease.id,
                          periodYear: year,
                          periodMonth: month,
                        },
                      },
                      create: {
                        organizationId,
                        leaseId: lease.id,
                        periodYear: year,
                        periodMonth: month,
                        amountDue: rec.rentAmount,
                        amountPaid:
                          ph.status === "paid" ? ph.amount
                          : ph.status === "partial" ? ph.amount
                          : 0,
                        status: ph.status,
                        dueDate: d,
                        paidAt: ph.status === "paid" || ph.status === "partial" ? d : undefined,
                        paymentMethod: ph.method || null,
                        recordedById: userId,
                      },
                      update: {},
                    });
                    coveredPeriods.add(`${year}-${month}`);
                    results.payments++;
                  }
                }

                // 3b. If there's an outstanding balance not covered by payment history,
                //     create an overdue record for the current period
                if (rec.balance && rec.balance > 0) {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = now.getMonth() + 1;
                  const periodKey = `${year}-${month}`;
                  if (!coveredPeriods.has(periodKey)) {
                    await prisma.rentPayment.upsert({
                      where: {
                        leaseId_periodYear_periodMonth: {
                          leaseId: lease.id,
                          periodYear: year,
                          periodMonth: month,
                        },
                      },
                      create: {
                        organizationId,
                        leaseId: lease.id,
                        periodYear: year,
                        periodMonth: month,
                        amountDue: rec.balance,
                        amountPaid: 0,
                        status: "overdue",
                        dueDate: new Date(year, month - 1, 1),
                        recordedById: userId,
                        notes: "Outstanding balance imported from previous platform",
                      },
                      update: {},
                    });
                    results.payments++;
                  }
                }
              }

              // Log activity
              await prisma.activityEvent.create({
                data: {
                  organizationId,
                  actorId: userId,
                  entityType: "tenant",
                  entityId: tenant.id,
                  eventType: "created",
                  metadata: { name: `${rec.firstName} ${rec.lastName}`, source: "smart_import" },
                },
              });
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          results.errors.push(`${rec.firstName} ${rec.lastName}: ${msg}`);
          results.skipped++;
        }
      }

      return Response.json(results);
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
