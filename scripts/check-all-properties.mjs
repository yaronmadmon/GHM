import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const all = await prisma.property.findMany({ orderBy: { createdAt: "asc" } });
console.log("Total properties (including archived):", all.length);
for (const p of all) {
  const status = p.archivedAt ? "[ARCHIVED]" : "[ACTIVE]  ";
  console.log(status, p.id, `"${p.name}"`, "|", p.addressLine1, p.city, "| created:", p.createdAt.toISOString().slice(0,19));
}

await prisma.$disconnect();
