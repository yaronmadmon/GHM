import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

for (const [suffix, name] of [["y7r55xwq","Haroldo"],["76jcdgzo","Justin"]]) {
  const lease = await prisma.lease.findFirst({ where: { id: { endsWith: suffix } } });
  if (!lease) { console.log(suffix, "not found"); continue; }
  const txns = await prisma.transaction.findMany({
    where: { leaseId: lease.id },
    orderBy: { date: "asc" },
    select: { type: true, category: true, amount: true, date: true, description: true },
  });
  console.log(`\n== ${name} ==`);
  for (const t of txns) {
    const sign = t.type === "income" ? "+" : "-";
    console.log(`  ${sign}${Number(t.amount)} | ${t.description}`);
  }
}
await prisma.$disconnect();
