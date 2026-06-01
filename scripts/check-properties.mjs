import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const props = await prisma.property.findMany({
  orderBy: { createdAt: "asc" },
  include: {
    units: {
      include: {
        leases: { where: { status: "active" }, include: { tenants: { include: { tenant: true } } } }
      }
    }
  }
});

for (const p of props) {
  const tenants = p.units.flatMap(u => u.leases.flatMap(l => l.tenants.map(lt => `${lt.tenant.firstName} ${lt.tenant.lastName}`)));
  console.log(`[${p.id}] "${p.name}" | ${p.addressLine1}, ${p.city} | units: ${p.units.length} | tenants: ${tenants.join(", ") || "none"} | created: ${p.createdAt.toISOString().slice(0,19)}`);
}

await prisma.$disconnect();
