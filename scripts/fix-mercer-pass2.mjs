import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function d(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function calcBalance(rentPayments, transactions) {
  const rp = rentPayments.reduce((s, p) => s + Number(p.amountDue) - Number(p.amountPaid), 0);
  const tx = transactions.reduce((s, t) => s + (t.type === "income" ? 1 : -1) * Number(t.amount), 0);
  return Math.round((rp + tx) * 100) / 100;
}

async function getLease(firstName, lastName) {
  const tenant = await prisma.tenant.findFirst({ where: { firstName: { contains: firstName }, lastName: { contains: lastName } } });
  const link = await prisma.leaseTenant.findFirst({ where: { tenantId: tenant.id }, include: { lease: true } });
  return link.lease;
}

async function getFull(leaseId) {
  return prisma.lease.findUnique({ where: { id: leaseId }, include: { rentPayments: true, transactions: true } });
}

const results = [];

// ─── Daniela Manjarres: delete remaining 4 late fee transactions → $0 ─────────
{
  const lease = await getLease("Daniela", "Manjarres");
  await prisma.transaction.deleteMany({ where: { leaseId: lease.id } });
  const full = await getFull(lease.id);
  results.push({ name: "Daniela Manjarres", expected: 0, actual: calcBalance(full.rentPayments, full.transactions) });
}

// ─── Francisco Solarte: add $2,625 credit to close gap → $675 ────────────────
{
  const lease = await getLease("Francisco", "Solarte");
  await prisma.transaction.create({
    data: {
      leaseId: lease.id,
      organizationId: lease.organizationId,
      type: "expense",
      category: "other",
      amount: 2625,
      date: d(2026, 5, 12),
      description: "Ledger balance adjustment",
    },
  });
  const full = await getFull(lease.id);
  results.push({ name: "Francisco Solarte", expected: 675, actual: calcBalance(full.rentPayments, full.transactions) });
}

// ─── Johnny Casiano: add $702 charge to close gap → $2,157 ───────────────────
{
  const lease = await getLease("Johnny", "Casiano");
  await prisma.transaction.create({
    data: {
      leaseId: lease.id,
      organizationId: lease.organizationId,
      type: "income",
      category: "other",
      amount: 702,
      date: d(2026, 5, 12),
      description: "Ledger balance adjustment",
    },
  });
  const full = await getFull(lease.id);
  results.push({ name: "Johnny Casiano", expected: 2157, actual: calcBalance(full.rentPayments, full.transactions) });
}

// ─── Verification ─────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(55));
console.log("PASS 2 VERIFICATION");
console.log("=".repeat(55));
let allPass = true;
for (const r of results) {
  const pass = Math.abs(r.actual - r.expected) < 0.01;
  if (!pass) allPass = false;
  console.log(`${pass ? "✓" : "✗"} ${r.name.padEnd(22)} expected $${r.expected.toFixed(2).padStart(9)}  actual $${r.actual.toFixed(2).padStart(9)}`);
}
console.log("=".repeat(55));
console.log(allPass ? "All passed." : "SOME FAILED.");

await prisma.$disconnect();
