import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// All leases with tenants, sorted by created date
const leases = await prisma.lease.findMany({
  orderBy: { createdAt: "desc" },
  take: 20,
  include: {
    unit: { include: { property: true } },
    tenants: { include: { tenant: true } },
  },
});

console.log("=== 20 most recent leases ===");
for (const l of leases) {
  const names = l.tenants.map(lt => `${lt.tenant.firstName} ${lt.tenant.lastName}`).join(", ");
  console.log(`${l.createdAt.toISOString().slice(0,19)} | ${l.unit.property.name} / Unit ${l.unit.unitNumber} | ${names} | rent $${l.rentAmount} | status: ${l.status}`);
}

// Show the Woodbine property details
const woodbine = await prisma.property.findFirst({
  where: { name: { contains: "Woodbine" } },
  include: { units: { include: { leases: { include: { tenants: { include: { tenant: true } } } } } } }
});
if (woodbine) {
  console.log("\n=== Woodbine property ===");
  console.log("Name:", woodbine.name);
  console.log("Address:", woodbine.addressLine1);
  console.log("City:", woodbine.city, "| State:", woodbine.state, "| Zip:", woodbine.zip);
  console.log("Units:", woodbine.units.length);
  for (const u of woodbine.units) {
    console.log(`  Unit ${u.unitNumber}:`, u.leases.map(l => l.tenants.map(lt => `${lt.tenant.firstName} ${lt.tenant.lastName}`).join(", ")).join(" / ") || "no leases");
  }
}

await prisma.$disconnect();
