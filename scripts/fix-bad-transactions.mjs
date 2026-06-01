/**
 * Cleanup: Remove misclassified transactions from the original smart import.
 *
 * Root cause: the old smart import saved ledger rows as Transaction records:
 *   - Rent charges → Transaction income (category: rent)  — these are CHARGES, not money received
 *   - Rent payments received → Transaction expense (category: other) — COMPLETELY WRONG type
 *
 * After fix-woodbine.mjs, Johanna has 30 proper RentPayment records.
 * All her old [Imported ledger] transactions are now pure duplicates or wrong.
 *
 * For all other properties the expense "Payment" rows must also be deleted.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ─── Step 1: Delete all [Imported ledger] transactions for Johanna ────────────
// She has 30 correct RentPayment records; these 153 Transaction records are
// either duplicates (income rent charges) or misclassified (expense payments).
const johannaLease = await prisma.lease.findFirst({
  where: { id: { endsWith: "qplnfqca" } },
});
if (johannaLease) {
  const del = await prisma.transaction.deleteMany({
    where: { leaseId: johannaLease.id, description: { contains: "[Imported ledger]" } },
  });
  console.log(`✓ Deleted ${del.count} [Imported ledger] transactions for Johanna`);
} else {
  console.log("⚠ Johanna lease not found (suffix qplnfqca)");
}

// ─── Step 2: Delete misclassified expense "payment" transactions ──────────────
// These are money RECEIVED from tenants, wrongly stored as type=expense.
// Pattern: category=other, description contains "Payment" — this reliably
// identifies tenant payment entries while sparing things like "Legal fee".
const expensePayments = await prisma.transaction.deleteMany({
  where: {
    type: "expense",
    category: "other",
    description: { contains: "Payment" },
  },
});
console.log(`✓ Deleted ${expensePayments.count} misclassified expense "Payment" transactions`);

// ─── Step 3: Show remaining expense transactions to verify ────────────────────
console.log("\n=== Remaining expense transactions ===");
const remaining = await prisma.transaction.findMany({
  where: { type: "expense" },
  orderBy: { amount: "desc" },
  select: { amount: true, category: true, description: true, date: true },
});
for (const t of remaining) {
  console.log(` $${Number(t.amount).toFixed(2)} | ${t.category} | ${(t.description ?? "").slice(0, 70)}`);
}
console.log("Total:", remaining.length, "| Sum: $" + remaining.reduce((s, t) => s + Number(t.amount), 0).toFixed(2));

// ─── Step 4: Show income-rent transactions still present ──────────────────────
console.log("\n=== Income transactions with category 'rent' (still present) ===");
const rentInc = await prisma.transaction.findMany({
  where: { type: "income", category: "rent" },
  include: { lease: { select: { id: true } } },
  orderBy: { amount: "desc" },
});
// Check which have RentPayment records
const leasesWithRP = new Set();
for (const t of rentInc) {
  if (!t.lease?.id) continue;
  const count = await prisma.rentPayment.count({ where: { leaseId: t.lease.id } });
  if (count > 0) leasesWithRP.add(t.lease.id);
}
for (const t of rentInc) {
  const hasRP = t.lease?.id && leasesWithRP.has(t.lease.id);
  console.log(` $${Number(t.amount).toFixed(2)} | ${hasRP ? "HAS-RP (duplicate)" : "no-RP"} | ${(t.description ?? "").slice(0, 60)}`);
}

// ─── Step 5: Summary of rent payments ────────────────────────────────────────
const rpSummary = await prisma.rentPayment.aggregate({
  _sum: { amountPaid: true, amountDue: true },
  _count: { id: true },
});
console.log(`\n=== RentPayment table ===`);
console.log(`Records: ${rpSummary._count.id} | Paid: $${Number(rpSummary._sum.amountPaid).toFixed(2)} | Due: $${Number(rpSummary._sum.amountDue).toFixed(2)}`);

await prisma.$disconnect();
