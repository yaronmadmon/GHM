import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const suffixes = { "y7r55xwq": "Haroldo J. Julien", "76jcdgzo": "Justin E. Virula" };

for (const [suffix, name] of Object.entries(suffixes)) {
  const lease = await prisma.lease.findFirst({
    where: { id: { endsWith: suffix } },
    include: {
      rentPayments: { orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }] },
    },
  });
  if (!lease) { console.log(suffix, "not found"); continue; }

  const txns = await prisma.transaction.findMany({
    where: { leaseId: lease.id },
    orderBy: { date: "asc" },
    select: { id: true, type: true, category: true, amount: true, date: true, description: true },
  });

  console.log(`\n${"=".repeat(60)}`);
  console.log(`${name} | lease: ...${suffix} | rent: $${Number(lease.rentAmount)}`);
  console.log(`RentPayments: ${lease.rentPayments.length}`);
  console.log(`Transactions: ${txns.length}`);

  // Show transactions
  let runningBalance = 0;
  console.log("\n--- Transactions (chronological) ---");
  for (const t of txns) {
    const sign = t.type === "income" ? +1 : -1;
    runningBalance += sign * Number(t.amount);
    const effect = t.type === "income" ? `+${Number(t.amount)}` : `-${Number(t.amount)}`;
    console.log(
      `  ${t.date.toISOString().slice(0,10)} | ${t.type.padEnd(7)} | ${t.category.padEnd(8)} | ${effect.padStart(8)} | bal: ${runningBalance.toFixed(2).padStart(9)} | ${(t.description || "").slice(0, 55)}`
    );
  }

  // Show rent payments
  if (lease.rentPayments.length > 0) {
    let rentBal = 0;
    console.log("\n--- RentPayments ---");
    for (const rp of lease.rentPayments) {
      rentBal += Number(rp.amountDue) - Number(rp.amountPaid);
      console.log(`  ${rp.periodYear}-${String(rp.periodMonth).padStart(2,"0")} | due: $${Number(rp.amountDue)} | paid: $${Number(rp.amountPaid)} | status: ${rp.status} | running: $${rentBal.toFixed(2)}`);
    }
  }

  console.log(`\n  => Calculated balance (formula): RentPayments + Transactions`);
  const rpBal = lease.rentPayments.reduce((s, p) => s + Number(p.amountDue) - Number(p.amountPaid), 0);
  const txnBal = txns.reduce((s, t) => s + (t.type === "income" ? 1 : -1) * Number(t.amount), 0);
  console.log(`     RentPayment balance: $${rpBal.toFixed(2)}`);
  console.log(`     Transaction balance: $${txnBal.toFixed(2)}`);
  console.log(`     TOTAL shown:         $${(rpBal + txnBal).toFixed(2)}`);
}

await prisma.$disconnect();
