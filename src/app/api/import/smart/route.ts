import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import OpenAI from "openai";
import * as XLSX from "xlsx";
import Papa from "papaparse";

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

function normalizePropertyText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\b(realty|properties|property|holdings|llc|inc|corp|corporation|company|co)\b/g, " ")
    .replace(/\b(street|str)\b/g, "st")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(place)\b/g, "pl")
    .replace(/\b(court)\b/g, "ct")
    .replace(/\b(north)\b/g, "n")
    .replace(/\b(south)\b/g, "s")
    .replace(/\b(east)\b/g, "e")
    .replace(/\b(west)\b/g, "w")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function addressNumber(value: string | null | undefined) {
  return normalizePropertyText(value).match(/^\d+/)?.[0] ?? null;
}

async function findMatchingProperty(
  organizationId: string,
  rec: ExtractedTenant,
) {
  const propName = rec.propertyName?.trim() || rec.propertyAddress?.trim() || "";
  const propAddress = rec.propertyAddress?.trim() || "";
  const normalizedName = normalizePropertyText(propName);
  const normalizedAddress = normalizePropertyText(propAddress);
  const targetNumber = addressNumber(propAddress) ?? addressNumber(propName);

  const candidates = await prisma.property.findMany({
    where: {
      organizationId,
      archivedAt: null,
      OR: [
        targetNumber ? { addressLine1: { startsWith: targetNumber, mode: "insensitive" } } : undefined,
        targetNumber ? { name: { contains: targetNumber, mode: "insensitive" } } : undefined,
        propAddress ? { addressLine1: { contains: propAddress, mode: "insensitive" } } : undefined,
        propName ? { name: { contains: propName, mode: "insensitive" } } : undefined,
      ].filter(Boolean) as object[],
    },
  });

  return candidates.find((property) => {
    const existingName = normalizePropertyText(property.name);
    const existingAddress = normalizePropertyText(property.addressLine1);

    if (normalizedAddress && existingAddress === normalizedAddress) return true;
    if (normalizedName && existingName === normalizedName) return true;

    const sameStreetNumber = targetNumber
      && (addressNumber(property.addressLine1) === targetNumber || addressNumber(property.name) === targetNumber);
    if (!sameStreetNumber) return false;

    const targetStreet = normalizedAddress || normalizedName;
    return Boolean(
      targetStreet
      && (
        existingAddress.includes(targetStreet)
        || targetStreet.includes(existingAddress)
        || existingName.includes(targetStreet)
        || targetStreet.includes(existingName)
      ),
    );
  }) ?? null;
}

async function findOrPrepareUnit(propertyId: string, unitNumber: string) {
  const exactUnit = await prisma.unit.findFirst({
    where: { propertyId, unitNumber },
  });
  if (exactUnit) return exactUnit;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      units: {
        include: { leases: { where: { status: "active" }, select: { id: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!property) return null;

  const unitCapacityReached = property.unitCount > 0 && property.units.length >= property.unitCount;
  const vacantPlaceholder = property.units.find((unit) => unit.status === "vacant" && unit.leases.length === 0);

  if (unitCapacityReached && vacantPlaceholder) {
    return prisma.unit.update({
      where: { id: vacantPlaceholder.id },
      data: { unitNumber },
    });
  }

  return prisma.unit.create({
    data: { propertyId, unitNumber },
  });
}

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
  ledgerRows?: Array<{
    date: string;
    kind: "charge" | "payment";
    category: "rent" | "late_fee" | "deposit" | "other";
    description: string;
    amount: number;
    runningBalance?: number;
  }>;
}

function safeDate(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

function parseMoney(value: string | undefined) {
  if (!value) return 0;
  return Number(value.replace(/[$,]/g, ""));
}

function isoFromLedgerDate(value: string) {
  const [month, day, year] = value.split("/").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts.shift() ?? "",
    lastName: parts.join(" ") || "Unknown",
  };
}

function ledgerCategory(description: string): "rent" | "late_fee" | "deposit" | "other" {
  if (/late fee/i.test(description)) return "late_fee";
  if (/deposit|security/i.test(description)) return "deposit";
  if (/rent income|rent correction|duplicate entry/i.test(description)) return "rent";
  return "other";
}

function parseTenantLedgerText(textContent: string): ExtractedTenant[] | null {
  if (!/Tenant Ledger/i.test(textContent) || !/Date\s+Payer\s+Description\s+Charges\s+Payments\s+Balance/i.test(textContent)) {
    return null;
  }

  const lines = textContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const tenantsLine = lines.find((line) => line.startsWith("Tenants:"));
  const unitLine = lines.find((line) => line.startsWith("Unit:"));
  const propertyLine = lines.find((line) => line.startsWith("Property:"));
  const phoneLine = lines.find((line) => line.startsWith("Mobile:"));
  const moveInLine = lines.find((line) => line.startsWith("Move in date:"));
  const leaseEndLine = lines.find((line) => line.startsWith("Lease Expiration:"));
  const rentLine = lines.find((line) => line.startsWith("Rent:"));
  const depositLine = lines.find((line) => line.startsWith("Deposit Paid:"));
  const totalLine = [...lines].reverse().find((line) => /^Total\s+-?[\d,]+\.\d{2}$/.test(line));

  if (!tenantsLine || !unitLine || !propertyLine || !moveInLine || !rentLine) return null;

  const tenantNames = tenantsLine.replace(/^Tenants:\s*/i, "").split(",").map((name) => name.trim()).filter(Boolean);
  const primaryName = splitName(tenantNames[0] ?? "");

  const propertyRaw = propertyLine.replace(/^Property:\s*/i, "");
  const propertyParts = propertyRaw.match(/^(.*?)\s+-\s+(.*)\s+([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  const propertyName = propertyParts?.[1]?.trim() ?? propertyRaw;
  const propertyAddress = propertyParts?.[2]?.trim() ?? propertyRaw;
  const city = propertyParts?.[3]?.trim();
  const state = propertyParts?.[4]?.trim();
  const zip = propertyParts?.[5]?.trim();

  const ledgerRows: NonNullable<ExtractedTenant["ledgerRows"]> = [];
  let lastRow: NonNullable<ExtractedTenant["ledgerRows"]>[number] | null = null;
  let previousBalance = 0;

  for (const line of lines) {
    const row = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})$/);
    if (row) {
      const [, date, description, amountText, balanceText] = row;
      const amount = parseMoney(amountText);
      const runningBalance = parseMoney(balanceText);
      const balanceDelta = Math.round((runningBalance - previousBalance) * 100) / 100;
      const isPayment = balanceDelta < 0 || (balanceDelta === 0 && /payment/i.test(description));
      lastRow = {
        date: isoFromLedgerDate(date),
        kind: isPayment ? "payment" : "charge",
        category: ledgerCategory(description),
        description,
        amount: Math.abs(balanceDelta || amount),
        runningBalance,
      };
      ledgerRows.push(lastRow);
      previousBalance = runningBalance;
      continue;
    }

    if (lastRow && !/^(Tenant Ledger|Date Payer|Created on|Total|Starting Balance)/i.test(line)) {
      lastRow.description = `${lastRow.description} ${line}`;
    }
  }

  if (!ledgerRows.length) return null;

  return [{
    firstName: primaryName.firstName,
    lastName: primaryName.lastName,
    phone: phoneLine?.replace(/^Mobile:\s*/i, "").trim(),
    propertyName,
    propertyAddress,
    city,
    state,
    zip,
    unitNumber: unitLine.replace(/^Unit:\s*/i, "").trim(),
    rentAmount: parseMoney(rentLine.replace(/^Rent:\s*/i, "")),
    depositAmount: parseMoney(depositLine?.replace(/^Deposit Paid:\s*/i, "")),
    depositPaid: Boolean(depositLine && parseMoney(depositLine.replace(/^Deposit Paid:\s*/i, "")) > 0),
    leaseStart: isoFromLedgerDate(moveInLine.replace(/^Move in date:\s*/i, "").trim()),
    leaseEnd: leaseEndLine ? isoFromLedgerDate(leaseEndLine.replace(/^Lease Expiration:\s*/i, "").trim()) : undefined,
    balance: totalLine ? parseMoney(totalLine.replace(/^Total\s+/i, "")) : ledgerRows.at(-1)?.runningBalance,
    notes: tenantNames.length > 1 ? `Co-tenants: ${tenantNames.slice(1).join(", ")}` : undefined,
    ledgerRows,
  }];
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
        message = await getOpenAIClient().chat.completions.create({
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
                const pages = data.Pages ?? [];
                const text = pages.map((page) => {
                  const texts = (page.Texts ?? [])
                    .map((t) => ({
                      x: "x" in t ? Number((t as { x?: number }).x ?? 0) : 0,
                      y: "y" in t ? Number((t as { y?: number }).y ?? 0) : 0,
                      text: decodeURIComponent(t.R?.[0]?.T ?? ""),
                    }))
                    .sort((a, b) => Math.abs(a.y - b.y) < 0.25 ? a.x - b.x : a.y - b.y);
                  const lines: string[] = [];
                  let current = "";
                  let lastY: number | null = null;
                  for (const item of texts) {
                    if (lastY !== null && Math.abs(item.y - lastY) > 0.25) {
                      if (current.trim()) lines.push(current.trim());
                      current = "";
                    }
                    current += `${current ? " " : ""}${item.text}`;
                    lastY = item.y;
                  }
                  if (current.trim()) lines.push(current.trim());
                  return lines.join("\n");
                }).join("\n");
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
          const deterministic = parseTenantLedgerText(textContent);
          if (deterministic) {
            return Response.json({ extracted: deterministic, truncated: false, totalRows: deterministic.length, parser: "tenant-ledger" });
          }
        } else {
          const wb = XLSX.read(buf, { type: "buffer" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          textContent = XLSX.utils.sheet_to_csv(ws);
        }
        const MAX_CHARS = 60_000;
        truncated = textContent.length > MAX_CHARS;
        const content = truncated ? textContent.slice(0, MAX_CHARS) + "\n... [truncated]" : textContent;
        message = await getOpenAIClient().chat.completions.create({
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
          const leaseStartDate = safeDate(rec.leaseStart);
          if (
            options.createLeases &&
            rec.propertyAddress &&
            rec.rentAmount &&
            leaseStartDate
          ) {
            // Find or create property. Match normalized names/addresses so
            // "147 Mercer Street" and "147 Mercer St Realty LLC" resolve together.
            const propName = rec.propertyName?.trim() || rec.propertyAddress.trim();
            let property = await findMatchingProperty(organizationId, rec);

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

            // Find or create unit. If a 9-unit property was pre-created with
            // placeholder unit names, rename an unused vacant placeholder
            // instead of creating a 10th+ unit.
            const unitNumber = rec.unitNumber?.trim() || "1";
            const unit = await findOrPrepareUnit(property.id, unitNumber);
            if (!unit) throw new Error(`Could not create or find unit ${unitNumber}`);

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
                  startDate: leaseStartDate,
                  endDate: safeDate(rec.leaseEnd),
                  rentAmount: rec.rentAmount,
                  depositAmount: rec.depositAmount ?? undefined,
                  depositPaid: rec.depositPaid ?? false,
                  depositPaidAt: rec.depositPaid ? leaseStartDate : undefined,
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
                if (rec.balance && rec.balance > 0 && !rec.paymentHistory?.length && !rec.ledgerRows?.length) {
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
                if (rec.ledgerRows?.length) {
                  for (const row of rec.ledgerRows) {
                    const d = new Date(row.date);
                    if (isNaN(d.getTime())) continue;
                    const type = row.kind === "charge" ? "income" : "expense";
                    const existing = await prisma.transaction.findFirst({
                      where: {
                        organizationId,
                        leaseId: lease.id,
                        type,
                        category: row.category,
                        amount: row.amount,
                        date: d,
                        description: `[Imported ledger] ${row.description}${row.runningBalance != null ? ` (balance: $${row.runningBalance})` : ""}`,
                      },
                    });
                    if (existing) continue;
                    await prisma.transaction.create({
                      data: {
                        organizationId,
                        leaseId: lease.id,
                        unitId: unit.id,
                        propertyId: property.id,
                        type,
                        category: row.category,
                        amount: row.amount,
                        date: d,
                        description: `[Imported ledger] ${row.description}${row.runningBalance != null ? ` (balance: $${row.runningBalance})` : ""}`,
                        createdById: userId,
                      },
                    });
                    results.transactions++;
                  }
                }

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
            } else if (options.createPayments && rec.ledgerRows?.length) {
              // A tenant ledger is authoritative. If this lease was previously
              // created by the older monthly-summary importer, replace those
              // imported financial rows with the exact ledger rows.
              await prisma.lease.update({
                where: { id: existingLease.id },
                data: {
                  startDate: leaseStartDate,
                  endDate: safeDate(rec.leaseEnd),
                  rentAmount: rec.rentAmount,
                  depositAmount: rec.depositAmount ?? undefined,
                  depositPaid: rec.depositPaid ?? false,
                  depositPaidAt: rec.depositPaid ? leaseStartDate : undefined,
                  status: "active",
                },
              });
              await prisma.unit.update({ where: { id: unit.id }, data: { status: "occupied" } });
              await prisma.rentPayment.deleteMany({ where: { leaseId: existingLease.id } });
              await prisma.transaction.deleteMany({
                where: {
                  leaseId: existingLease.id,
                  OR: [
                    { description: { startsWith: "[Imported ledger]" } },
                    { description: { startsWith: "[Imported]" } },
                  ],
                },
              });

              for (const row of rec.ledgerRows) {
                const d = new Date(row.date);
                if (isNaN(d.getTime())) continue;
                await prisma.transaction.create({
                  data: {
                    organizationId,
                    leaseId: existingLease.id,
                    unitId: unit.id,
                    propertyId: property.id,
                    type: row.kind === "charge" ? "income" : "expense",
                    category: row.category,
                    amount: row.amount,
                    date: d,
                    description: `[Imported ledger] ${row.description}${row.runningBalance != null ? ` (balance: $${row.runningBalance})` : ""}`,
                    createdById: userId,
                  },
                });
                results.transactions++;
              }
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
