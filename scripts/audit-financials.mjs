import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const now = new Date();

// Transactions summary
const txns = await prisma.transaction.groupBy({
  by: ["type"],
  _sum: { amount: true },
  _count: { id: true },
  where: { date: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) } }
});
console.log("=== Transactions (trailing 12mo) by type ===");
for (const t of txns) console.log(" ", t.type, "| count:", t._count.id, "| sum: $" + Number(t._sum.amount).toFixed(2));

// Transactions by category
const txnsByCat = await prisma.transaction.groupBy({
  by: ["type", "category"],
  _sum: { amount: true },
  _count: { id: true },
  where: { date: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) } },
  orderBy: { _sum: { amount: "desc" } }
});
console.log("\n=== Transactions (trailing 12mo) by type+category ===");
for (const t of txnsByCat) console.log(" ", t.type, t.category, "| count:", t._count.id, "| sum: $" + Number(t._sum.amount).toFixed(2));

// Current month transactions
const txnsMonth = await prisma.transaction.groupBy({
  by: ["type"],
  _sum: { amount: true },
  _count: { id: true },
  where: { date: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } }
});
console.log("\n=== Transactions current month ===");
for (const t of txnsMonth) console.log(" ", t.type, "| count:", t._count.id, "| sum: $" + Number(t._sum.amount).toFixed(2));

// All rent payments
const rp = await prisma.rentPayment.aggregate({ _sum: { amountPaid: true, amountDue: true }, _count: { id: true } });
console.log("\n=== All RentPayments ===");
console.log("  count:", rp._count.id, "| amountDue: $" + Number(rp._sum.amountDue).toFixed(2), "| amountPaid: $" + Number(rp._sum.amountPaid).toFixed(2));

// Current month rent payments
const rpMonth = await prisma.rentPayment.aggregate({
  _sum: { amountPaid: true, amountDue: true },
  _count: { id: true },
  where: { periodYear: now.getFullYear(), periodMonth: now.getMonth() + 1 }
});
console.log("\n=== RentPayments current month (" + (now.getMonth()+1) + "/" + now.getFullYear() + ") ===");
console.log("  count:", rpMonth._count.id, "| amountDue: $" + Number(rpMonth._sum.amountDue).toFixed(2), "| amountPaid: $" + Number(rpMonth._sum.amountPaid).toFixed(2));

// Trailing 12 months rent payments
const trailing12Months = Array.from({length:12}, (_,i) => {
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
  return { periodYear: d.getFullYear(), periodMonth: d.getMonth()+1 };
});
const rpTrailing = await prisma.rentPayment.findMany({
  where: { OR: trailing12Months },
  select: { amountPaid: true, amountDue: true, periodYear: true, periodMonth: true, status: true }
});
const rpPaidSum = rpTrailing.reduce((s,p) => s + Number(p.amountPaid), 0);
const rpDueSum = rpTrailing.reduce((s,p) => s + Number(p.amountDue), 0);
console.log("\n=== RentPayments trailing 12 months ===");
console.log("  records:", rpTrailing.length, "| amountPaid sum: $" + rpPaidSum.toFixed(2), "| amountDue sum: $" + rpDueSum.toFixed(2));

// Rent payments by status
const rpByStatus = rpTrailing.reduce((acc, p) => {
  acc[p.status] = (acc[p.status] ?? 0) + Number(p.amountPaid);
  return acc;
}, {});
console.log("  by status amountPaid:", Object.entries(rpByStatus).map(([k,v]) => `${k}: $${Number(v).toFixed(2)}`).join(", "));

// Active leases
const leaseAgg = await prisma.lease.aggregate({ _sum: { rentAmount: true }, _count: { id: true }, where: { status: "active" } });
console.log("\n=== Active Leases ===");
console.log("  count:", leaseAgg._count.id, "| monthly rent roll: $" + Number(leaseAgg._sum.rentAmount).toFixed(2));

// Top 10 expense transactions
const topExp = await prisma.transaction.findMany({
  where: { type: "expense" },
  orderBy: { amount: "desc" },
  take: 10,
  select: { amount: true, category: true, description: true, date: true }
});
console.log("\n=== Top 10 expense transactions ===");
for (const t of topExp) console.log("  $" + Number(t.amount).toFixed(2), "|", t.category, "|", (t.description ?? "").slice(0, 60));

// YTD transactions
const txnsYTD = await prisma.transaction.groupBy({
  by: ["type"],
  _sum: { amount: true },
  _count: { id: true },
  where: { date: { gte: new Date(now.getFullYear(), 0, 1) } }
});
console.log("\n=== Transactions YTD ===");
for (const t of txnsYTD) console.log(" ", t.type, "| count:", t._count.id, "| sum: $" + Number(t._sum.amount).toFixed(2));

await prisma.$disconnect();
