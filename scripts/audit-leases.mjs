import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Check leases with the "imported ledger" transactions
const problemLeases = ["y7r55xwq", "76jcdgzo", "qplnfqca", "egz7h7rb"];

for (const suffix of problemLeases) {
  const lease = await prisma.lease.findFirst({
    where: { id: { endsWith: suffix } },
    include: {
      unit: { include: { property: true } },
      tenants: { include: { tenant: true } },
    },
  });
  if (!lease) { console.log(suffix, "NOT FOUND"); continue; }

  const rentPayments = await prisma.rentPayment.count({ where: { leaseId: lease.id } });
  const transactions = await prisma.transaction.count({ where: { leaseId: lease.id } });
  const expenseTxns = await prisma.transaction.findMany({
    where: { leaseId: lease.id, type: "expense" },
    select: { amount: true, description: true, category: true }
  });
  const incomeTxns = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { leaseId: lease.id, type: "income" } });

  const tenantName = lease.tenants[0]?.tenant ? `${lease.tenants[0].tenant.firstName} ${lease.tenants[0].tenant.lastName}` : "?";
  console.log(`\n[${suffix}] ${tenantName} | ${lease.unit.property.name} Unit ${lease.unit.unitNumber}`);
  console.log(`  RentPayments: ${rentPayments} | Transactions: ${transactions}`);
  console.log(`  Income txns total: $${Number(incomeTxns._sum.amount ?? 0).toFixed(2)}`);
  console.log(`  Expense txns: ${expenseTxns.length}`);
  for (const t of expenseTxns) console.log(`    - $${Number(t.amount).toFixed(2)} | ${t.category} | ${(t.description||"").slice(0,60)}`);
}

// Also show a summary of all leases and their rent payment / transaction counts
console.log("\n=== All active leases summary ===");
const all = await prisma.lease.findMany({
  where: { status: "active" },
  include: {
    unit: { include: { property: true } },
    tenants: { include: { tenant: true } },
    _count: { select: { rentPayments: true, transactions: true } },
  }
});
for (const l of all) {
  const name = l.tenants[0]?.tenant ? `${l.tenants[0].tenant.firstName} ${l.tenants[0].tenant.lastName}` : "?";
  const prop = `${l.unit.property.name} U${l.unit.unitNumber}`;
  console.log(`  ${name.padEnd(25)} | ${prop.padEnd(35)} | rentPmts: ${l._count.rentPayments} | txns: ${l._count.transactions}`);
}

await prisma.$disconnect();
