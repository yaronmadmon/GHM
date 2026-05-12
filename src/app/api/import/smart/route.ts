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
  ledgerEntries?: Array<{
    date: string;             // YYYY-MM-DD
    type: "late_fee" | "legal_fee" | "court_cost" | "attorney_fee" | "nsf_fee" | "returned_payment" | "credit" | "adjustment" | "deposit" | "other";
    description: string;      // verbatim from source document
    amount: number;           // positive = charge/debit, negative = credit/payment
    runningBalance?: number;  // balance after this entry if shown in source
  }>;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") ?? "extract";

    // ── EXTRACT: parse file + ask GPT-4o ─────────────────────────────────────
    if (action === "extract") {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) return Response.json({ error: "No file provided" }, { status: 400 });

      const buf = Buffer.from(await file.arrayBuffer());
      const isImage = file.type.startsWith("image/") ||
        /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file.name);

      const extractionPrompt = `You are a data extraction assistant for a property management app. Extract every tenant/renter you can find from this document.

IMPORTANT: This data may be used in legal proceedings. Your job is to EXTRACT, not to filter or decide what matters. Capture every row, every charge, every fee, every payment — exactly as it appears. Do not skip anything. Do not summarize or combine entries. Do not decide what is "relevant". If you see it in the document, it goes in the output.

Return ONLY a valid JSON array — no explanation, no markdown, no code fences. Each element:
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
  ],
  "ledgerEntries": [
    { "date": "YYYY-MM-DD", "type": string, "description": string, "amount": number, "runningBalance": number }
  ]
}

FIELD RULES:
- firstName and lastName are REQUIRED. Split "John Smith" → firstName:"John", lastName:"Smith".
- Strip $ and commas from all money values.
- depositPaid: true if deposit was received/paid.
- balance: final outstanding amount the tenant owes. 0 if fully current.
- All dates → YYYY-MM-DD. Never omit a date that is present in the document.
- Never guess an email or phone — omit if not clearly present.
- Merge multiple rows for the same tenant into one record.
- Return [] only if there are absolutely no people or rental records.

PAYMENT HISTORY (paymentHistory array) — one entry per lease month, from lease start through today:
- Include EVERY calendar month from the lease start date through the current month — do NOT skip any month, even if no payment was received.
- For months where rent WAS received: date = the actual receipt date, amount = the amount received, status = "paid" (if full rent covered) or "partial" (if only part was paid), method = payment method if shown.
- For months where NO payment was received (tenant owes but did not pay): date = the first day of that month (YYYY-MM-01), amount = 0, status = "overdue". YOU MUST STILL INCLUDE THESE MONTHS.
- If a tenant made multiple payments in one month, list each one separately.
- CRITICAL — Balance column is NOT a payment: The "Balance" or "Running Balance" column in a ledger shows cumulative debt owed — NEVER use those figures as an "amount". Only extract amounts from columns labeled "Received", "Payment", "Paid", or similar. A running balance of $8,000 does NOT mean $8,000 was paid.
- method: payment method if shown (cash, check, money order, ACH, etc.).

LEDGER ENTRIES (ledgerEntries array) — EVERY row that is NOT a regular monthly rent charge or rent payment:
- DO NOT include regular monthly rent charges (e.g. "Rent — March 2025") in ledgerEntries — those go in paymentHistory.
- DO NOT include the tenant's rent payments in ledgerEntries — those go in paymentHistory.
- EVERYTHING ELSE goes in ledgerEntries. Do not skip any row. Do not decide it is unimportant. Examples:
  * Late fees, late charges → type: "late_fee"
  * NSF fees, bounced check fees → type: "nsf_fee"
  * Returned / rejected / reversed payments (a payment that was submitted but came back) → type: "returned_payment" with POSITIVE amount (it adds back to what is owed)
  * Attorney fees, legal representation fees → type: "attorney_fee"
  * Court filing fees, court costs → type: "court_cost"
  * Other legal fees → type: "legal_fee"
  * Security deposit charges or deposit corrections → type: "deposit"
  * Credits or refunds issued to the tenant → type: "credit" (use NEGATIVE amount)
  * Balance corrections or adjustments → type: "adjustment"
  * Utility charges, repairs billed to tenant, any other charge → type: "other"
- description: copy the EXACT text from the document, word for word, including any codes or reference numbers.
- amount: POSITIVE for charges/debits that increase what the tenant owes. NEGATIVE for credits that reduce what the tenant owes.
- runningBalance: include the value from the "Balance" column for that row if one is shown.
- DO NOT SKIP ANY ROW. When in doubt, include it with type "other". It is better to include something than to omit it.`;

      let message;
      let truncated = false;

      if (isImage) {
        // Send image directly to GPT-4o vision
        const base64 = buf.toString("base64");
        const mimeType = file.type || "image/png";
        message = await client.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 8192,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: extractionPrompt },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" } },
              ],
            },
          ],
        });
      } else {
        // Text-based extraction (CSV, XLSX, PDF, pasted text)
        let textContent = "";
        if (file.name.endsWith(".csv") || file.type === "text/csv") {
          textContent = buf.toString("utf-8");
        } else if (file.name.endsWith(".pdf") || file.type === "application/pdf") {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const PDFParser = require("pdf2json");
            textContent = await new Promise<string>((resolve, reject) => {
              const parser = new PDFParser(null, 1);
              parser.on("pdfParser_dataError", (e: { parserError: unknown }) => reject(e.parserError));
              parser.on("pdfParser_dataReady", (data: { Pages?: Array<{ Texts?: Array<{ R?: Array<{ T?: string }> }> }> }) => {
                const text = (data.Pages ?? [])
                  .flatMap((p) => p.Texts ?? [])
                  .map((t) => decodeURIComponent(t.R?.[0]?.T ?? ""))
                  .join(" ");
                resolve(text);
              });
              parser.parseBuffer(buf);
            });
          } catch {
            return Response.json(
              { error: "Could not read this PDF — try taking a screenshot of it instead and uploading that." },
              { status: 422 }
            );
          }
          if (!textContent?.trim()) {
            return Response.json(
              { error: "This PDF appears to be image-only (scanned). Take a screenshot and upload the image instead." },
              { status: 422 }
            );
          }
        } else {
          const wb = XLSX.read(buf, { type: "buffer" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          textContent = XLSX.utils.sheet_to_csv(ws);
        }
        const MAX_CHARS = 60_000;
        truncated = textContent.length > MAX_CHARS;
        const content = truncated ? textContent.slice(0, MAX_CHARS) + "\n... [truncated]" : textContent;
        message = await client.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 8192,
          messages: [
            { role: "system", content: extractionPrompt },
            { role: "user", content: `Extract all tenant records:\n\n${content}` },
          ],
        });
      }

      const rawText = message.choices[0].message.content ?? "[]";

      let extracted: ExtractedTenant[] = [];
      try {
        // Strip markdown code fences if model wrapped the JSON
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
        transactions: 0,
        skipped: 0,
        errors: [] as string[],
      };

      for (const rec of records) {
        if (!rec.firstName || !rec.lastName) { results.skipped++; continue; }

        try {
          // 1. Create or find tenant — match by email, phone, or full name
          const existingTenant = await prisma.tenant.findFirst({
            where: {
              organizationId,
              OR: [
                rec.email ? { email: rec.email } : undefined,
                rec.phone ? { phone: rec.phone } : undefined,
                {
                  firstName: { equals: rec.firstName.trim(), mode: "insensitive" },
                  lastName: { equals: rec.lastName.trim(), mode: "insensitive" },
                },
              ].filter(Boolean) as object[],
            },
          });

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
                // 3a. Import rent payment history records
                // Group multiple payments in the same month and sum them up
                const coveredPeriods = new Set<string>();
                if (rec.paymentHistory?.length) {
                  // Group by year-month
                  const monthGroups = new Map<string, {
                    year: number; month: number; totalPaid: number;
                    lastDate: Date; lastMethod?: string; lastStatus: string;
                  }>();
                  for (const ph of rec.paymentHistory) {
                    const d = new Date(ph.date);
                    if (isNaN(d.getTime())) continue;
                    const year = d.getFullYear();
                    const month = d.getMonth() + 1;
                    const key = `${year}-${month}`;
                    const existing = monthGroups.get(key);
                    const paidAmount = (ph.status === "paid" || ph.status === "partial") ? ph.amount : 0;
                    if (existing) {
                      existing.totalPaid += paidAmount;
                      if (d > existing.lastDate) {
                        existing.lastDate = d;
                        existing.lastMethod = ph.method;
                        existing.lastStatus = ph.status;
                      }
                    } else {
                      monthGroups.set(key, {
                        year, month, totalPaid: paidAmount,
                        lastDate: d, lastMethod: ph.method, lastStatus: ph.status,
                      });
                    }
                  }

                  for (const g of monthGroups.values()) {
                    // Determine final status: if totalPaid >= rentAmount → paid, else partial
                    const finalStatus = g.totalPaid >= rec.rentAmount
                      ? "paid"
                      : g.totalPaid > 0
                      ? "partial"
                      : (g.lastStatus as "pending" | "overdue");
                    await prisma.rentPayment.upsert({
                      where: {
                        leaseId_periodYear_periodMonth: {
                          leaseId: lease.id,
                          periodYear: g.year,
                          periodMonth: g.month,
                        },
                      },
                      create: {
                        organizationId,
                        leaseId: lease.id,
                        periodYear: g.year,
                        periodMonth: g.month,
                        amountDue: rec.rentAmount,
                        amountPaid: g.totalPaid,
                        status: finalStatus,
                        dueDate: new Date(g.year, g.month - 1, 1),
                        paidAt: g.totalPaid > 0 ? g.lastDate : undefined,
                        paymentMethod: g.lastMethod || null,
                        recordedById: userId,
                      },
                      update: {},
                    });
                    coveredPeriods.add(`${g.year}-${g.month}`);
                    results.payments++;
                  }
                }

                // 3b. If there's an outstanding balance but no payment history at all,
                //     create an overdue record for the current period as a fallback.
                //     amountDue must be the monthly rent, NOT the total balance.
                if (rec.balance && rec.balance > 0 && !rec.paymentHistory?.length) {
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
                        amountDue: rec.rentAmount ?? 0,
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

                // 3c. Import ledger entries (late fees, legal fees, court costs, etc.)
                //     as Transaction records
                if (rec.ledgerEntries?.length) {
                  const categoryMap: Record<string, string> = {
                    late_fee: "late_fee",
                    nsf_fee: "late_fee",
                    returned_payment: "other",
                    attorney_fee: "other",
                    legal_fee: "other",
                    court_cost: "other",
                    credit: "other",
                    adjustment: "other",
                    deposit: "deposit",
                    other: "other",
                  };
                  for (const entry of rec.ledgerEntries) {
                    const d = new Date(entry.date);
                    if (isNaN(d.getTime())) continue;
                    const isCredit = entry.amount < 0;
                    await prisma.transaction.create({
                      data: {
                        organizationId,
                        leaseId: lease.id,
                        unitId: unit.id,
                        propertyId: property.id,
                        type: isCredit ? "expense" : "income",
                        category: categoryMap[entry.type] ?? "other",
                        amount: Math.abs(entry.amount),
                        date: d,
                        description: `[Imported] ${entry.description}${entry.runningBalance != null ? ` (balance: $${entry.runningBalance})` : ""}`,
                        createdById: userId,
                      },
                    });
                    results.transactions++;
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
