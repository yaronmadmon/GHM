import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function calcBalance(rentPayments, transactions) {
  const rp = rentPayments.reduce((s, p) => s + Number(p.amountDue) - Number(p.amountPaid), 0);
  const tx = transactions.reduce((s, t) => s + (t.type === "income" ? 1 : -1) * Number(t.amount), 0);
  return Math.round((rp + tx) * 100) / 100;
}

async function show(firstName, lastName) {
  const tenant = await prisma.tenant.findFirst({ where: { firstName: { contains: firstName }, lastName: { contains: lastName } } });
  const link = await prisma.leaseTenant.findFirst({
    where: { tenantId: tenant.id },
    include: { lease: { include: { transactions: true, rentPayments: true } } },
  });
  const l = link.lease;
  const rpBal = l.rentPayments.reduce((s, p) => s + Number(p.amountDue) - Number(p.amountPaid), 0);
  const txBal = l.transactions.reduce((s, t) => s + (t.type === "income" ? 1 : -1) * Number(t.amount), 0);
  console.log(`\n== ${firstName} ${lastName} ==`);
  console.log(`  RentPayment balance: ${rpBal.toFixed(2)}`);
  console.log(`  Transaction balance: ${txBal.toFixed(2)}`);
  console.log(`  Total: ${(rpBal + txBal).toFixed(2)}`);
  console.log(`  Transactions:`);
  for (const t of l.transactions) {
    console.log(`    ${t.type}/${t.category} $${Number(t.amount)} | ${(t.description||"").slice(0,60)}`);
  }
}

await show("Daniela", "Manjarres");
await show("Francisco", "Solarte");
await show("Johnny", "Casiano");

await prisma.$disconnect();
