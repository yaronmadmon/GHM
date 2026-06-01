/**
 * Fix Woodbine property + import all 3 ledgers:
 *   Unit 1 — Erin A. Espinal (balance $7,533.31)
 *   Unit 2 — Johanna M. Fabre Rivas + Andres V. Fabre (balance $0)
 *   Unit 3 — Leila M. Sacks + 3 co-tenants (balance $0)
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const ORG_ID    = "cmp1ruj4i0002s6d6qryhxgnc";
const PROP_ID   = "cmp26xdpy00mbs6d67iem2lid";

// ─── helpers ──────────────────────────────────────────────────────────────────

function d(str) { return new Date(str); }

function groupPaymentsByMonth(payments) {
  const map = new Map();
  for (const { date, amount } of payments) {
    const dt = new Date(date);
    const key = `${dt.getFullYear()}-${dt.getMonth() + 1}`;
    const entry = map.get(key) ?? { year: dt.getFullYear(), month: dt.getMonth() + 1, total: 0, lastDate: dt };
    entry.total += amount;
    if (dt > entry.lastDate) entry.lastDate = dt;
    map.set(key, entry);
  }
  return [...map.values()];
}

async function upsertRentPayments(leaseId, rentAmount, monthlyPayments) {
  for (const { year, month, total, lastDate } of monthlyPayments) {
    const status = total >= rentAmount ? "paid" : total > 0 ? "partial" : "overdue";
    await prisma.rentPayment.upsert({
      where: { leaseId_periodYear_periodMonth: { leaseId, periodYear: year, periodMonth: month } },
      create: {
        organizationId: ORG_ID, leaseId,
        periodYear: year, periodMonth: month,
        amountDue: rentAmount, amountPaid: total,
        status,
        dueDate: new Date(year, month - 1, 1),
        paidAt: total > 0 ? lastDate : null,
      },
      update: { amountDue: rentAmount, amountPaid: total, status, paidAt: total > 0 ? lastDate : null },
    });
  }
}

async function createTransactions(leaseId, unitId, entries) {
  for (const { date, type, description, amount } of entries) {
    const isCredit = amount < 0;
    const existing = await prisma.transaction.findFirst({
      where: { leaseId, date: new Date(date), description, amount: Math.abs(amount) },
    });
    if (existing) continue;
    await prisma.transaction.create({
      data: {
        organizationId: ORG_ID, leaseId, unitId, propertyId: PROP_ID,
        type: isCredit ? "expense" : "income",
        category: type === "late_fee" ? "late_fee" : type === "deposit" ? "deposit" : "other",
        amount: Math.abs(amount),
        date: new Date(date),
        description: `[Imported] ${description}`,
      },
    });
  }
}

// ─── STEP 1: Fix property record ──────────────────────────────────────────────
console.log("=== Step 1: Fix property ===");
await prisma.property.update({
  where: { id: PROP_ID },
  data: {
    name: "Avraham Berko LLC - 265 Woodbine St",
    addressLine1: "265 Woodbine St",
    city: "Brooklyn",
    state: "NY",
    zip: "",
    propertyType: "multi_family",
    unitCount: 3,
  },
});
console.log("✓ Property updated");

// ─── STEP 2: Unit 2 — Johanna M. Fabre Rivas + Andres V. Fabre ────────────────
console.log("\n=== Step 2: Unit 2 — Johanna + Andres ===");

const unit2 = await prisma.unit.findFirst({ where: { propertyId: PROP_ID, unitNumber: "2" } });
if (!unit2) throw new Error("Unit 2 not found");
console.log("✓ Found Unit 2:", unit2.id);

// Find or create Johanna
let johanna = await prisma.tenant.findFirst({
  where: { organizationId: ORG_ID, OR: [
    { phone: "(929) 432-9482" },
    { firstName: "Johanna", lastName: { startsWith: "Fabre" } },
  ]},
});
if (!johanna) {
  johanna = await prisma.tenant.create({
    data: { organizationId: ORG_ID, firstName: "Johanna", lastName: "M. Fabre Rivas", phone: "(929) 432-9482" },
  });
  console.log("✓ Created tenant Johanna");
} else {
  console.log("✓ Found existing tenant Johanna:", johanna.id);
}

// Find or create Andres
let andres = await prisma.tenant.findFirst({
  where: { organizationId: ORG_ID, firstName: "Andres", lastName: { startsWith: "Fabre" } },
});
if (!andres) {
  andres = await prisma.tenant.create({
    data: { organizationId: ORG_ID, firstName: "Andres", lastName: "V. Fabre" },
  });
  console.log("✓ Created tenant Andres V. Fabre");
} else {
  console.log("✓ Found existing tenant Andres:", andres.id);
}

// Get existing lease for unit 2
let lease2 = await prisma.lease.findFirst({ where: { unitId: unit2.id, status: "active" } });
if (!lease2) {
  lease2 = await prisma.lease.create({
    data: {
      organizationId: ORG_ID, unitId: unit2.id,
      startDate: d("2021-07-01"), endDate: d("2024-11-30"),
      rentAmount: 3250, depositAmount: 2500, depositPaid: true, depositPaidAt: d("2023-10-26"),
      status: "active",
      tenants: { create: [{ tenantId: johanna.id, isPrimary: true }] },
    },
  });
  console.log("✓ Created lease for Unit 2");
} else {
  await prisma.lease.update({
    where: { id: lease2.id },
    data: { startDate: d("2021-07-01"), endDate: d("2024-11-30"), rentAmount: 3250, depositAmount: 2500, depositPaid: true },
  });
  console.log("✓ Updated existing lease for Unit 2:", lease2.id);
}

// Add Andres as co-tenant if not already there
const existingAndres = await prisma.leaseTenant.findFirst({ where: { leaseId: lease2.id, tenantId: andres.id } });
if (!existingAndres) {
  await prisma.leaseTenant.create({ data: { leaseId: lease2.id, tenantId: andres.id, isPrimary: false } });
  console.log("✓ Added Andres as co-tenant");
}

// Clear old payment records and re-import
await prisma.rentPayment.deleteMany({ where: { leaseId: lease2.id } });
await prisma.transaction.deleteMany({ where: { leaseId: lease2.id, description: { startsWith: "[Imported]" } } });

// Johanna payments by month received (from ledger Payments column, grouped by month)
const johannaPayments = [
  // Dec 2023
  { date: "2023-12-31", amount: 3000 },
  // Jan 2024
  { date: "2024-01-01", amount: 2925 },
  // Mar 2024 (lump — clears Feb+Mar arrears)
  { date: "2024-03-02", amount: 5925 },
  // May 2024 (clears Apr+May)
  { date: "2024-05-03", amount: 5925 },
  // Feb 2025 (clears Jun 2024 — Feb 2025 arrears)
  { date: "2025-02-01", amount: 26925 },
  // Jun 2025 (clears Mar-Jun 2025)
  { date: "2025-06-08", amount: 12000 },
  // Jan 2026 (clears Jul 2025 — Jan 2026)
  { date: "2026-01-12", amount: 21000 },
  // May 2026 (clears Feb-May 2026)
  { date: "2026-05-11", amount: 13900 },
];

// For months with $0 payment, add overdue records (Dec 2023 → May 2026)
// We track which months have payments
const johannaMonthlyPayments = groupPaymentsByMonth(johannaPayments);
// Add explicit $0 overdue months for Feb 2024, Apr 2024, Jun-Jan2025, Mar-May2025, Jul-Dec2025, Feb-Apr2026
const johannaPaidMonths = new Set(johannaMonthlyPayments.map(p => `${p.year}-${p.month}`));
const johannaAllMonths = [];
// Generate all months from Dec 2023 to May 2026
for (let y = 2023; y <= 2026; y++) {
  const startM = y === 2023 ? 12 : 1;
  const endM = y === 2026 ? 5 : 12;
  for (let m = startM; m <= endM; m++) {
    johannaAllMonths.push({ year: y, month: m, total: 0, lastDate: new Date(y, m-1, 1) });
  }
}
// Merge with actual payments
for (const paid of johannaMonthlyPayments) {
  const existing = johannaAllMonths.find(m => m.year === paid.year && m.month === paid.month);
  if (existing) { existing.total = paid.total; existing.lastDate = paid.lastDate; }
}

// Rent was $2,775 from Dec 2023 through Jan 2026, then $3,250 from Feb 2026
for (const row of johannaAllMonths) {
  const rentAtTime = (row.year < 2026 || (row.year === 2026 && row.month < 2)) ? 2775 : 3250;
  const status = row.total >= rentAtTime ? "paid" : row.total > 0 ? "partial" : "overdue";
  await prisma.rentPayment.upsert({
    where: { leaseId_periodYear_periodMonth: { leaseId: lease2.id, periodYear: row.year, periodMonth: row.month } },
    create: {
      organizationId: ORG_ID, leaseId: lease2.id,
      periodYear: row.year, periodMonth: row.month,
      amountDue: rentAtTime, amountPaid: row.total, status,
      dueDate: new Date(row.year, row.month - 1, 1),
      paidAt: row.total > 0 ? row.lastDate : null,
    },
    update: { amountDue: rentAtTime, amountPaid: row.total, status, paidAt: row.total > 0 ? row.lastDate : null },
  });
}
console.log(`✓ Imported ${johannaAllMonths.length} rent payment records for Johanna`);

// Johanna ledger entries (late fees, electricity, credits, deposit)
await createTransactions(lease2.id, unit2.id, [
  { date: "2023-10-24", type: "deposit", description: "Owner Held Security Deposits - Move In Charge", amount: 2500 },
  { date: "2023-12-01", type: "other", description: "Electricity - December 2023", amount: 150 },
  { date: "2023-12-06", type: "late_fee", description: "Late Fee for Dec 2023", amount: 75 },
  { date: "2024-01-01", type: "other", description: "Electricity - January 2024", amount: 150 },
  { date: "2024-02-01", type: "other", description: "Electricity - February 2024", amount: 150 },
  { date: "2024-02-06", type: "late_fee", description: "Late Fee for Feb 2024", amount: 75 },
  { date: "2024-03-01", type: "other", description: "Electricity - March 2024", amount: 150 },
  { date: "2024-04-01", type: "other", description: "Electricity - April 2024", amount: 150 },
  { date: "2024-04-06", type: "late_fee", description: "Late Fee for Apr 2024", amount: 75 },
  { date: "2024-05-01", type: "other", description: "Electricity - May 2024", amount: 150 },
  { date: "2024-06-01", type: "other", description: "Electricity - June 2024", amount: 150 },
  { date: "2024-06-06", type: "late_fee", description: "Late Fee for Jun 2024", amount: 75 },
  { date: "2024-07-01", type: "other", description: "Electricity - July 2024", amount: 150 },
  { date: "2024-07-06", type: "late_fee", description: "Late Fee for Jul 2024", amount: 75 },
  { date: "2024-08-01", type: "other", description: "Electricity - August 2024", amount: 150 },
  { date: "2024-08-06", type: "late_fee", description: "Late Fee for Aug 2024", amount: 75 },
  { date: "2024-09-01", type: "other", description: "Electricity - September 2024", amount: 150 },
  { date: "2024-09-06", type: "late_fee", description: "Late Fee for Sep 2024", amount: 75 },
  { date: "2024-10-01", type: "other", description: "Electricity - October 2024", amount: 150 },
  { date: "2024-10-06", type: "late_fee", description: "Late Fee for Oct 2024", amount: 75 },
  { date: "2024-11-01", type: "other", description: "Electricity - November 2024", amount: 150 },
  { date: "2024-11-06", type: "late_fee", description: "Late Fee for Nov 2024", amount: 75 },
  { date: "2024-12-01", type: "other", description: "Electricity - December 2024", amount: 150 },
  { date: "2024-12-06", type: "late_fee", description: "Late Fee for Dec 2024", amount: 75 },
  { date: "2025-01-01", type: "other", description: "Electricity - January 2025", amount: 150 },
  { date: "2025-01-06", type: "late_fee", description: "Late Fee for Jan 2025", amount: 75 },
  { date: "2025-02-01", type: "other", description: "Electricity - February 2025", amount: 150 },
  { date: "2025-03-01", type: "other", description: "Electricity - March 2025", amount: 150 },
  { date: "2025-03-06", type: "late_fee", description: "Late Fee for Mar 2025", amount: 75 },
  { date: "2025-04-01", type: "other", description: "Electricity - April 2025", amount: 150 },
  { date: "2025-04-06", type: "late_fee", description: "Late Fee for Apr 2025", amount: 75 },
  { date: "2025-05-01", type: "other", description: "Electricity - May 2025", amount: 150 },
  { date: "2025-05-06", type: "late_fee", description: "Late Fee for May 2025", amount: 75 },
  { date: "2025-06-01", type: "other", description: "Electricity - June 2025", amount: 150 },
  { date: "2025-06-06", type: "late_fee", description: "Late Fee for Jun 2025", amount: 75 },
  { date: "2025-07-01", type: "other", description: "Electricity - July 2025", amount: 150 },
  { date: "2025-07-06", type: "late_fee", description: "Late Fee for Jul 2025", amount: 75 },
  { date: "2025-08-01", type: "other", description: "Electricity - August 2025", amount: 150 },
  { date: "2025-08-06", type: "late_fee", description: "Late Fee for Aug 2025", amount: 75 },
  { date: "2025-09-01", type: "other", description: "Electricity - September 2025", amount: 150 },
  { date: "2025-09-06", type: "late_fee", description: "Late Fee for Sep 2025", amount: 75 },
  { date: "2025-10-01", type: "other", description: "Electricity - October 2025", amount: 150 },
  { date: "2025-10-06", type: "late_fee", description: "Late Fee for Oct 2025", amount: 75 },
  { date: "2025-11-01", type: "other", description: "Electricity - November 2025", amount: 150 },
  { date: "2025-11-06", type: "late_fee", description: "Late Fee for Nov 2025", amount: 75 },
  { date: "2025-12-01", type: "other", description: "Electricity - December 2025", amount: 150 },
  { date: "2025-12-06", type: "late_fee", description: "Late Fee for Dec 2025", amount: 75 },
  { date: "2026-01-01", type: "other", description: "Electricity - January 2026", amount: 150 },
  { date: "2026-01-06", type: "late_fee", description: "Late Fee for Jan 2026", amount: 75 },
  { date: "2026-02-01", type: "other", description: "Electricity - February 2026", amount: 150 },
  { date: "2026-02-06", type: "late_fee", description: "Late Fee for Feb 2026", amount: 75 },
  { date: "2026-03-01", type: "other", description: "Electricity - March 2026", amount: 150 },
  { date: "2026-03-06", type: "late_fee", description: "Late Fee for Mar 2026", amount: 75 },
  { date: "2026-04-01", type: "other", description: "Electricity - April 2026", amount: 150 },
  { date: "2026-04-06", type: "late_fee", description: "Late Fee for Apr 2026", amount: 75 },
  { date: "2026-05-01", type: "other", description: "Electricity - May 2026", amount: 150 },
  { date: "2026-05-06", type: "late_fee", description: "Late Fee for May 2026", amount: 75 },
]);
console.log("✓ Imported Johanna transactions");
await prisma.unit.update({ where: { id: unit2.id }, data: { status: "occupied" } });

// ─── STEP 3: Unit 1 — Erin A. Espinal ────────────────────────────────────────
console.log("\n=== Step 3: Unit 1 — Erin A. Espinal ===");

let unit1 = await prisma.unit.findFirst({ where: { propertyId: PROP_ID, unitNumber: "1" } });
if (!unit1) {
  unit1 = await prisma.unit.create({ data: { propertyId: PROP_ID, unitNumber: "1", status: "occupied" } });
  console.log("✓ Created Unit 1");
} else {
  await prisma.unit.update({ where: { id: unit1.id }, data: { status: "occupied" } });
  console.log("✓ Found existing Unit 1:", unit1.id);
}

let erin = await prisma.tenant.findFirst({
  where: { organizationId: ORG_ID, OR: [
    { phone: "(929) 355-4960" },
    { firstName: "Erin", lastName: { startsWith: "Espinal" } },
  ]},
});
if (!erin) {
  erin = await prisma.tenant.create({
    data: { organizationId: ORG_ID, firstName: "Erin", lastName: "A. Espinal", phone: "(929) 355-4960" },
  });
  console.log("✓ Created tenant Erin");
} else {
  console.log("✓ Found existing tenant Erin:", erin.id);
}

let lease1 = await prisma.lease.findFirst({ where: { unitId: unit1.id } });
if (!lease1) {
  lease1 = await prisma.lease.create({
    data: {
      organizationId: ORG_ID, unitId: unit1.id,
      startDate: d("2022-02-09"), endDate: null,
      rentAmount: 4050, depositAmount: 800, depositPaid: true, depositPaidAt: d("2022-02-09"),
      status: "active",
      tenants: { create: [{ tenantId: erin.id, isPrimary: true }] },
    },
  });
  console.log("✓ Created lease for Unit 1");
} else {
  await prisma.lease.update({
    where: { id: lease1.id },
    data: { startDate: d("2022-02-09"), endDate: null, rentAmount: 4050, depositAmount: 800, depositPaid: true, status: "active" },
  });
  console.log("✓ Updated existing lease for Unit 1:", lease1.id);
}

await prisma.rentPayment.deleteMany({ where: { leaseId: lease1.id } });
await prisma.transaction.deleteMany({ where: { leaseId: lease1.id, description: { startsWith: "[Imported]" } } });

// Erin raw payments from ledger (all entries in Payments column)
const erinRawPayments = [
  { date: "2025-01-02", amount: 600 },
  { date: "2025-01-06", amount: 900 },
  { date: "2025-01-10", amount: 1300 },
  { date: "2025-01-10", amount: 900 },
  { date: "2025-02-03", amount: 600 },
  { date: "2025-02-03", amount: 1000 },
  { date: "2025-02-07", amount: 800 },
  { date: "2025-02-18", amount: 1300 },
  { date: "2025-02-24", amount: 900 },
  { date: "2025-03-03", amount: 600 },
  { date: "2025-03-03", amount: 900 },
  { date: "2025-03-07", amount: 900 },
  { date: "2025-04-01", amount: 600 },
  { date: "2025-04-02", amount: 900 },
  { date: "2025-04-07", amount: 900 },
  { date: "2025-04-14", amount: 900 },
  { date: "2025-05-02", amount: 600 },
  { date: "2025-05-05", amount: 900 },
  { date: "2025-05-05", amount: 900 },
  { date: "2025-05-27", amount: 900 },
  { date: "2025-06-03", amount: 1500 },
  { date: "2025-06-26", amount: 900 },
  { date: "2025-07-02", amount: 600 },
  { date: "2025-07-07", amount: 900 },
  { date: "2025-07-25", amount: 1300 },
  { date: "2025-07-31", amount: 900 },
  { date: "2025-08-05", amount: 8000 },
  { date: "2025-08-22", amount: 430 },
  { date: "2025-08-22", amount: 1000 },
  { date: "2025-09-02", amount: 900 },
  { date: "2025-09-02", amount: 1000 },
  { date: "2025-09-02", amount: 800 },
  { date: "2025-09-04", amount: 600 },
  { date: "2025-09-15", amount: 1300 },
  { date: "2025-10-01", amount: 600 },
  { date: "2025-10-03", amount: 600 },
  { date: "2025-10-03", amount: 900 },
  { date: "2025-11-02", amount: 900 },
  { date: "2025-11-03", amount: 1300 },
  { date: "2025-11-16", amount: 537.50 },
  { date: "2025-11-23", amount: 107.50 },
  { date: "2025-11-30", amount: 600 },
  { date: "2025-12-01", amount: 1300 },
  { date: "2025-12-01", amount: 600 },
  { date: "2025-12-02", amount: 900 },
  { date: "2025-12-05", amount: 900 },
  { date: "2025-12-30", amount: 900 },
  { date: "2025-12-30", amount: 600 },
  { date: "2026-01-05", amount: 1200 },
  { date: "2026-01-05", amount: 900 },
  { date: "2026-01-28", amount: 600 },
  { date: "2026-02-02", amount: 1000 },
  { date: "2026-02-03", amount: 1300 },
  { date: "2026-02-03", amount: 691.69 },
  { date: "2026-02-27", amount: 900 },
  { date: "2026-03-01", amount: 1300 },
  { date: "2026-03-01", amount: 900 },
  { date: "2026-03-09", amount: 600 },
  { date: "2026-04-02", amount: 900 },
  { date: "2026-04-03", amount: 900 },
  { date: "2026-04-04", amount: 600 },
  { date: "2026-04-07", amount: 1300 },
  { date: "2026-04-28", amount: 600 },
  { date: "2026-04-29", amount: 1300 },
  { date: "2026-04-30", amount: 900 },
];

const erinMonthly = groupPaymentsByMonth(erinRawPayments);
// Add overdue for months with no payments (Jan 2025 through May 2026 are the tracked months)
const erinAllMonths = [];
for (let y = 2025; y <= 2026; y++) {
  for (let m = (y === 2025 ? 1 : 1); m <= (y === 2026 ? 5 : 12); m++) {
    erinAllMonths.push({ year: y, month: m, total: 0, lastDate: new Date(y, m-1, 1) });
  }
}
for (const paid of erinMonthly) {
  const existing = erinAllMonths.find(m => m.year === paid.year && m.month === paid.month);
  if (existing) { existing.total = paid.total; existing.lastDate = paid.lastDate; }
}

await upsertRentPayments(lease1.id, 4050, erinAllMonths);
console.log(`✓ Imported ${erinAllMonths.length} rent payment records for Erin`);

// Erin ledger entries — late fees, credits, adjustments, deposit
await createTransactions(lease1.id, unit1.id, [
  { date: "2022-02-09", type: "deposit", description: "Owner Held Security Deposits - Move In Charge", amount: 800 },
  { date: "2022-02-14", type: "late_fee", description: "Late Fee for Feb 2022", amount: 75 },
  { date: "2025-01-06", type: "late_fee", description: "Late Fee for Jan 2025", amount: 75 },
  // Jan duplicate charge correction
  { date: "2025-01-01", type: "adjustment", description: "Rent Income - duplicate charge correction", amount: -4050 },
  { date: "2025-02-06", type: "late_fee", description: "Late Fee for Feb 2025", amount: 75 },
  { date: "2025-03-06", type: "late_fee", description: "Late Fee for Mar 2025", amount: 75 },
  { date: "2025-04-06", type: "late_fee", description: "Late Fee for Apr 2025", amount: 75 },
  { date: "2025-05-06", type: "late_fee", description: "Late Fee for May 2025", amount: 75 },
  { date: "2025-06-06", type: "late_fee", description: "Late Fee for Jun 2025", amount: 75 },
  { date: "2025-07-06", type: "late_fee", description: "Late Fee for Jul 2025", amount: 75 },
  // Aug duplicate correction
  { date: "2025-08-01", type: "adjustment", description: "Rent Income - duplicate charge correction Aug 2025", amount: -4200 },
  { date: "2025-08-06", type: "late_fee", description: "Late Fee for Aug 2025", amount: 75 },
  { date: "2025-09-06", type: "late_fee", description: "Late Fee for Sep 2025", amount: 75 },
  { date: "2025-10-01", type: "credit", description: "Rent Income - managing credit Oct 2025", amount: -300 },
  { date: "2025-10-06", type: "late_fee", description: "Late Fee for Oct 2025", amount: 75 },
  { date: "2025-11-01", type: "credit", description: "Rent Income - managing credit Nov 2025", amount: -300 },
  { date: "2025-11-06", type: "late_fee", description: "Late Fee for Nov 2025", amount: 75 },
  { date: "2025-12-01", type: "credit", description: "Rent Income - managing credit Dec 2025", amount: -300 },
  { date: "2025-12-06", type: "late_fee", description: "Late Fee for Dec 2025", amount: 75 },
  { date: "2026-01-06", type: "late_fee", description: "Late Fee for Jan 2026", amount: 75 },
  { date: "2026-01-12", type: "credit", description: "Cleaning and Maintenance - Other", amount: -300 },
  { date: "2026-02-01", type: "credit", description: "Rent Income - managing credit Feb 2026", amount: -300 },
  { date: "2026-02-06", type: "late_fee", description: "Late Fee for Feb 2026", amount: 75 },
  { date: "2026-03-01", type: "credit", description: "Rent Income - managing credit Mar 2026", amount: -300 },
  { date: "2026-03-06", type: "late_fee", description: "Late Fee for Mar 2026", amount: 75 },
  { date: "2026-04-01", type: "credit", description: "Rent Income - managing credit Apr 2026", amount: -300 },
  { date: "2026-04-06", type: "late_fee", description: "Late Fee for Apr 2026", amount: 75 },
  { date: "2026-05-01", type: "credit", description: "Rent Income - managing credit May 2026", amount: -300 },
  { date: "2026-05-06", type: "late_fee", description: "Late Fee for May 2026", amount: 75 },
]);
console.log("✓ Imported Erin transactions");

// ─── STEP 4: Unit 3 — Leila M. Sacks + co-tenants ───────────────────────────
console.log("\n=== Step 4: Unit 3 — Leila M. Sacks et al. ===");

let unit3 = await prisma.unit.findFirst({ where: { propertyId: PROP_ID, unitNumber: "3" } });
if (!unit3) {
  unit3 = await prisma.unit.create({ data: { propertyId: PROP_ID, unitNumber: "3", status: "occupied" } });
  console.log("✓ Created Unit 3");
} else {
  await prisma.unit.update({ where: { id: unit3.id }, data: { status: "occupied" } });
  console.log("✓ Found existing Unit 3:", unit3.id);
}

// Find or create all 4 tenants
const unit3Tenants = [
  { firstName: "Leila", lastName: "M. Sacks", phone: "(909) 477-7567", isPrimary: true },
  { firstName: "Cristina", lastName: "Barco", isPrimary: false },
  { firstName: "Gabrielle", lastName: "S. Fairchild", isPrimary: false },
  { firstName: "Nicholas", lastName: "D. Vitiello", isPrimary: false },
];

const unit3TenantRecords = [];
for (const t of unit3Tenants) {
  let existing = await prisma.tenant.findFirst({
    where: { organizationId: ORG_ID, firstName: t.firstName, lastName: { startsWith: t.lastName.split(".")[0].trim() } },
  });
  if (!existing) {
    existing = await prisma.tenant.create({
      data: { organizationId: ORG_ID, firstName: t.firstName, lastName: t.lastName, phone: t.phone ?? null },
    });
    console.log(`✓ Created tenant ${t.firstName} ${t.lastName}`);
  } else {
    console.log(`✓ Found existing tenant ${t.firstName}:`, existing.id);
  }
  unit3TenantRecords.push({ tenant: existing, isPrimary: t.isPrimary });
}

let lease3 = await prisma.lease.findFirst({ where: { unitId: unit3.id } });
if (!lease3) {
  lease3 = await prisma.lease.create({
    data: {
      organizationId: ORG_ID, unitId: unit3.id,
      startDate: d("2024-10-01"), endDate: d("2026-04-30"),
      rentAmount: 3650, depositAmount: 3650, depositPaid: true, depositPaidAt: d("2024-09-30"),
      status: "active",
      tenants: { create: unit3TenantRecords.map(r => ({ tenantId: r.tenant.id, isPrimary: r.isPrimary })) },
    },
  });
  console.log("✓ Created lease for Unit 3");
} else {
  await prisma.lease.update({
    where: { id: lease3.id },
    data: { startDate: d("2024-10-01"), endDate: d("2026-04-30"), rentAmount: 3650, depositAmount: 3650, depositPaid: true, status: "active" },
  });
  // Add missing co-tenants
  for (const { tenant, isPrimary } of unit3TenantRecords) {
    const exists = await prisma.leaseTenant.findFirst({ where: { leaseId: lease3.id, tenantId: tenant.id } });
    if (!exists) await prisma.leaseTenant.create({ data: { leaseId: lease3.id, tenantId: tenant.id, isPrimary } });
  }
  console.log("✓ Updated existing lease for Unit 3:", lease3.id);
}

await prisma.rentPayment.deleteMany({ where: { leaseId: lease3.id } });
await prisma.transaction.deleteMany({ where: { leaseId: lease3.id, description: { startsWith: "[Imported]" } } });

// Leila payments grouped by month
const leilaPayments = [
  // Oct 2024 — Lauren O'Hear installments + Leila lump
  { date: "2024-10-02", amount: 500 }, { date: "2024-10-03", amount: 500 }, { date: "2024-10-04", amount: 500 },
  { date: "2024-10-05", amount: 500 }, { date: "2024-10-07", amount: 500 }, { date: "2024-10-08", amount: 500 },
  { date: "2024-10-09", amount: 500 }, { date: "2024-10-12", amount: 150 },
  { date: "2024-10-29", amount: 3500 }, { date: "2024-10-29", amount: 150 },
  // Nov 2024
  { date: "2024-11-25", amount: 3500 }, { date: "2024-11-26", amount: 150 },
  // Dec 2024
  { date: "2024-12-22", amount: 3500 },
  // Jan 2025 — covered by prior credit, $0 direct payment
  // Apr 2025 — lump covers Feb+Mar+Apr
  { date: "2025-04-01", amount: 11100 },
  // May 2025
  { date: "2025-05-07", amount: 3725 },
  // Jul 2025 — covers Jun+Jul
  { date: "2025-07-23", amount: 7450 },
  // Aug 2025
  { date: "2025-08-13", amount: 3725 }, { date: "2025-08-29", amount: 3650 },
  // Jan 2026 — covers Oct+Nov+Dec 2025+Jan 2026
  { date: "2026-01-26", amount: 14900 },
  // Mar 2026 — covers Feb+Mar 2026
  { date: "2026-03-22", amount: 7450 },
  // May 2026 — covers Apr+May 2026
  { date: "2026-05-11", amount: 7450 },
];

const leilaMonthly = groupPaymentsByMonth(leilaPayments);
const leilaAllMonths = [];
for (let y = 2024; y <= 2026; y++) {
  for (let m = (y === 2024 ? 10 : 1); m <= (y === 2026 ? 5 : 12); m++) {
    leilaAllMonths.push({ year: y, month: m, total: 0, lastDate: new Date(y, m-1, 1) });
  }
}
for (const paid of leilaMonthly) {
  const existing = leilaAllMonths.find(m => m.year === paid.year && m.month === paid.month);
  if (existing) { existing.total = paid.total; existing.lastDate = paid.lastDate; }
}

await upsertRentPayments(lease3.id, 3650, leilaAllMonths);
console.log(`✓ Imported ${leilaAllMonths.length} rent payment records for Leila`);

// Leila ledger entries
await createTransactions(lease3.id, unit3.id, [
  { date: "2024-09-05", type: "deposit", description: "Owner Held Security Deposits - Move In Charge", amount: 3650 },
  { date: "2024-10-06", type: "late_fee", description: "Late Fee for Oct 2024", amount: 75 },
  { date: "2024-10-10", type: "credit", description: "Late Fee credit reversal", amount: -75 },
  { date: "2024-11-06", type: "late_fee", description: "Late Fee for Nov 2024", amount: 75 },
  { date: "2024-11-10", type: "credit", description: "Late Fee credit reversal", amount: -75 },
  { date: "2024-12-06", type: "late_fee", description: "Late Fee for Dec 2024", amount: 75 },
  { date: "2024-12-22", type: "credit", description: "Rent Income credit adjustment", amount: -85 },
  { date: "2024-12-22", type: "credit", description: "Rent Income credit adjustment 2", amount: -150 },
  { date: "2025-02-06", type: "late_fee", description: "Late Fee for Feb 2025", amount: 75 },
  { date: "2025-03-06", type: "late_fee", description: "Late Fee for Mar 2025", amount: 75 },
  { date: "2025-05-06", type: "late_fee", description: "Late Fee for May 2025", amount: 75 },
  { date: "2025-06-06", type: "late_fee", description: "Late Fee for Jun 2025", amount: 75 },
  { date: "2025-07-06", type: "late_fee", description: "Late Fee for Jul 2025", amount: 75 },
  { date: "2025-08-06", type: "late_fee", description: "Late Fee for Aug 2025", amount: 75 },
  { date: "2025-10-06", type: "late_fee", description: "Late Fee for Oct 2025", amount: 75 },
  { date: "2025-11-06", type: "late_fee", description: "Late Fee for Nov 2025", amount: 75 },
  { date: "2025-12-06", type: "late_fee", description: "Late Fee for Dec 2025", amount: 75 },
  { date: "2026-01-06", type: "late_fee", description: "Late Fee for Jan 2026", amount: 75 },
  { date: "2026-02-06", type: "late_fee", description: "Late Fee for Feb 2026", amount: 75 },
  { date: "2026-03-06", type: "late_fee", description: "Late Fee for Mar 2026", amount: 75 },
  { date: "2026-04-06", type: "late_fee", description: "Late Fee for Apr 2026", amount: 75 },
  { date: "2026-05-06", type: "late_fee", description: "Late Fee for May 2026", amount: 75 },
]);
console.log("✓ Imported Leila transactions");

// ─── Final summary ────────────────────────────────────────────────────────────
console.log("\n=== Done ===");
const prop = await prisma.property.findUnique({
  where: { id: PROP_ID },
  include: { units: { include: { leases: { include: { tenants: { include: { tenant: true } } } } } } },
});
console.log(`Property: ${prop.name} | ${prop.addressLine1}, ${prop.city}, ${prop.state}`);
for (const u of prop.units.sort((a, b) => a.unitNumber.localeCompare(b.unitNumber))) {
  const lease = u.leases[0];
  const names = lease?.tenants.map(lt => `${lt.tenant.firstName} ${lt.tenant.lastName}`).join(", ") || "vacant";
  console.log(`  Unit ${u.unitNumber}: ${names} | rent $${lease?.rentAmount ?? 0}`);
}

await prisma.$disconnect();
