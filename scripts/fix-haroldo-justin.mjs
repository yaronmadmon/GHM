/**
 * Fix balances for Haroldo J. Julien and Justin E. Virula.
 *
 * Both leases had their entire payment history stored as Transaction records
 * from the original smart import. This script:
 *  1. Deletes all [Imported ledger] transactions for both leases
 *  2. Creates proper RentPayment records (paid months) + outstanding late fee Transactions
 *
 * Target balances:
 *  - Haroldo J. Julien : $2,225  (May 2026 rent $1,700 + 7 late fees $525)
 *  - Justin E. Virula  : $75     (one outstanding late fee — all rent paid)
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ─── helpers ─────────────────────────────────────────────────────────────────
function d(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

async function processLease(suffix, label, work) {
  const lease = await prisma.lease.findFirst({ where: { id: { endsWith: suffix } } });
  if (!lease) { console.log(`⚠ Lease ${suffix} not found`); return; }
  console.log(`\n=== ${label} | lease ...${suffix} | rent $${Number(lease.rentAmount)} ===`);
  await work(lease);
}

// ─── 1. Delete all [Imported ledger] transactions for both leases ─────────────
for (const suffix of ["y7r55xwq", "76jcdgzo"]) {
  const lease = await prisma.lease.findFirst({ where: { id: { endsWith: suffix } } });
  if (!lease) continue;
  const del = await prisma.transaction.deleteMany({
    where: { leaseId: lease.id, description: { contains: "[Imported ledger]" } },
  });
  console.log(`✓ Deleted ${del.count} [Imported ledger] transactions for ...${suffix}`);
}

// ─── 2. Haroldo J. Julien — target balance $2,225 ────────────────────────────
// Rent $1,700/month, started Nov 2025.
// History: Nov 2025 – Apr 2026 fully paid; May 2026 overdue.
// Late fees: $75 × 7 months (Nov 2025 – May 2026), all outstanding.
// RentPayment balance: $1,700 (May) + Transaction balance: $525 (late fees) = $2,225
await processLease("y7r55xwq", "Haroldo J. Julien", async (lease) => {
  const rent = 1700;

  // Create paid RentPayments for Nov 2025 – Apr 2026 (6 months)
  const paidMonths = [
    [2025, 11], [2025, 12],
    [2026, 1],  [2026, 2],  [2026, 3],  [2026, 4],
  ];
  for (const [year, month] of paidMonths) {
    await prisma.rentPayment.upsert({
      where: { leaseId_periodYear_periodMonth: { leaseId: lease.id, periodYear: year, periodMonth: month } },
      update: { amountDue: rent, amountPaid: rent, status: "paid" },
      create: {
        leaseId: lease.id,
        organizationId: lease.organizationId,
        periodYear: year,
        periodMonth: month,
        amountDue: rent,
        amountPaid: rent,
        status: "paid",
        dueDate: d(year, month, 1),
        paidAt: d(year, month, 1),
      },
    });
  }
  console.log(`  ✓ Created/updated 6 paid RentPayments (Nov 2025 – Apr 2026)`);

  // Create overdue RentPayment for May 2026
  await prisma.rentPayment.upsert({
    where: { leaseId_periodYear_periodMonth: { leaseId: lease.id, periodYear: 2026, periodMonth: 5 } },
    update: { amountDue: rent, amountPaid: 0, status: "overdue" },
    create: {
      leaseId: lease.id,
      organizationId: lease.organizationId,
      periodYear: 2026,
      periodMonth: 5,
      amountDue: rent,
      amountPaid: 0,
      status: "overdue",
      dueDate: d(2026, 5, 1),
      paidAt: null,
    },
  });
  console.log(`  ✓ Created May 2026 RentPayment: OVERDUE ($1,700)`);

  // Create outstanding late fee transactions (7 months, $75 each, never paid)
  const lateFeeMonths = [
    { year: 2025, month: 11, date: d(2025, 11, 6) },
    { year: 2025, month: 12, date: d(2025, 12, 6) },
    { year: 2026, month:  1, date: d(2026,  1, 6) },
    { year: 2026, month:  2, date: d(2026,  2, 6) },
    { year: 2026, month:  3, date: d(2026,  3, 6) },
    { year: 2026, month:  4, date: d(2026,  4, 6) },
    { year: 2026, month:  5, date: d(2026,  5, 6) },
  ];
  for (const { year, month, date } of lateFeeMonths) {
    await prisma.transaction.create({
      data: {
        leaseId: lease.id,
        organizationId: lease.organizationId,
        type: "income",
        category: "late_fee",
        amount: 75,
        date,
        description: `Late Fee - ${date.toISOString().slice(0, 7)}`,
      },
    });
  }
  console.log(`  ✓ Created 7 late fee transactions ($75 × 7 = $525)`);
  console.log(`  => Expected balance: $1,700 (May rent) + $525 (late fees) = $2,225`);
});

// ─── 3. Justin E. Virula — target balance $75 ────────────────────────────────
// Rent $1,100/month, started Mar 2026.
// History: Mar, Apr, May 2026 all paid; one $75 late fee outstanding.
await processLease("76jcdgzo", "Justin E. Virula", async (lease) => {
  const rent = 1100;

  // Create paid RentPayments for Mar – May 2026 (all paid)
  const paidMonths = [[2026, 3], [2026, 4], [2026, 5]];
  for (const [year, month] of paidMonths) {
    await prisma.rentPayment.upsert({
      where: { leaseId_periodYear_periodMonth: { leaseId: lease.id, periodYear: year, periodMonth: month } },
      update: { amountDue: rent, amountPaid: rent, status: "paid" },
      create: {
        leaseId: lease.id,
        organizationId: lease.organizationId,
        periodYear: year,
        periodMonth: month,
        amountDue: rent,
        amountPaid: rent,
        status: "paid",
        dueDate: d(year, month, 1),
        paidAt: d(year, month, 1),
      },
    });
  }
  console.log(`  ✓ Created/updated 3 paid RentPayments (Mar – May 2026)`);

  // One outstanding late fee (May 2026)
  await prisma.transaction.create({
    data: {
      leaseId: lease.id,
      organizationId: lease.organizationId,
      type: "income",
      category: "late_fee",
      amount: 75,
      date: d(2026, 5, 6),
      description: "Late Fee - 2026-05",
    },
  });
  console.log(`  ✓ Created 1 outstanding late fee transaction ($75)`);
  console.log(`  => Expected balance: $0 (all rent paid) + $75 (late fee) = $75`);
});

// ─── 4. Verify final balances ─────────────────────────────────────────────────
console.log("\n=== Final balance verification ===");
for (const [suffix, name] of [["y7r55xwq", "Haroldo J. Julien"], ["76jcdgzo", "Justin E. Virula"]]) {
  const lease = await prisma.lease.findFirst({
    where: { id: { endsWith: suffix } },
    include: {
      rentPayments: true,
      transactions: { select: { type: true, amount: true } },
    },
  });
  if (!lease) continue;
  const rpBal = lease.rentPayments.reduce((s, p) => s + Number(p.amountDue) - Number(p.amountPaid), 0);
  const txnBal = lease.transactions.reduce(
    (s, t) => s + (t.type === "income" ? 1 : -1) * Number(t.amount), 0
  );
  console.log(`  ${name}: RentPayments $${rpBal.toFixed(2)} + Transactions $${txnBal.toFixed(2)} = $${(rpBal + txnBal).toFixed(2)}`);
}

await prisma.$disconnect();
