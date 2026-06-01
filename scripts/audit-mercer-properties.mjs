import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Find properties matching "Mercer"
const properties = await prisma.property.findMany({
  where: { OR: [{ name: { contains: "Mercer" } }, { addressLine1: { contains: "Mercer" } }] },
  include: {
    units: {
      include: {
        leases: {
          where: { status: "active" },
          include: {
            tenants: { include: { tenant: { select: { firstName: true, lastName: true } } } },
            rentPayments: true,
            transactions: { select: { type: true, category: true, amount: true, description: true } },
          },
        },
      },
    },
  },
});

for (const prop of properties) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Property: ${prop.name} | ${prop.addressLine1}, ${prop.city} ${prop.state}`);
  for (const unit of prop.units) {
    for (const lease of unit.leases) {
      const tenantNames = lease.tenants.map(lt => `${lt.tenant.firstName} ${lt.tenant.lastName}`).join(", ");
      const rpBal = lease.rentPayments.reduce((s, p) => s + Number(p.amountDue) - Number(p.amountPaid), 0);
      const txnBal = lease.transactions.reduce((s, t) => s + (t.type === "income" ? 1 : -1) * Number(t.amount), 0);
      const balance = rpBal + txnBal;
      console.log(`  Unit ${unit.unitNumber} | ${tenantNames} | rent $${Number(lease.rentAmount)} | balance $${balance.toFixed(2)}`);
      console.log(`    RentPayments: ${lease.rentPayments.length} | Transactions: ${lease.transactions.length}`);
      if (lease.rentPayments.length > 0) {
        const months = lease.rentPayments.map(rp => `${rp.periodYear}-${String(rp.periodMonth).padStart(2,"0")}(${rp.status},$${Number(rp.amountPaid)}/${Number(rp.amountDue)})`).join(" ");
        console.log(`    Payments: ${months}`);
      }
      if (lease.transactions.length > 0) {
        for (const t of lease.transactions) {
          console.log(`    Txn: ${t.type}/${t.category} $${Number(t.amount)} | ${(t.description||"").slice(0,60)}`);
        }
      }
    }
  }
}

await prisma.$disconnect();
