import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

console.log("=== All expense transactions ===");
const badExpenses = await prisma.transaction.findMany({
  where: { type: "expense" },
  orderBy: { amount: "desc" },
  select: { id: true, amount: true, category: true, description: true, date: true, leaseId: true }
});
for (const t of badExpenses) {
  console.log(` $${Number(t.amount).toFixed(2)} | ${t.category} | ${t.leaseId ? "lease:"+t.leaseId.slice(-8) : "NO-LEASE"} | ${(t.description||"").slice(0, 70)}`);
}
console.log("Total expense txns:", badExpenses.length, "| Total: $" + badExpenses.reduce((s,t) => s + Number(t.amount), 0).toFixed(2));

console.log("\n=== Income transactions with category 'rent' ===");
const rentInc = await prisma.transaction.findMany({
  where: { type: "income", category: "rent" },
  orderBy: { amount: "desc" },
  select: { id: true, amount: true, description: true, date: true, leaseId: true }
});
for (const t of rentInc) {
  console.log(` $${Number(t.amount).toFixed(2)} | ${t.leaseId ? "lease:"+t.leaseId.slice(-8) : "NO-LEASE"} | ${(t.description||"").slice(0, 70)}`);
}
console.log("Total income-rent txns:", rentInc.length, "| Total: $" + rentInc.reduce((s,t) => s + Number(t.amount), 0).toFixed(2));

await prisma.$disconnect();
