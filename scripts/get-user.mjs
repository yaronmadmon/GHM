import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const users = await prisma.user.findMany({ select: { email: true, name: true, organizationId: true, createdAt: true } });
for (const u of users) console.log(u.email, "|", u.name, "| org:", u.organizationId, "| created:", u.createdAt.toISOString().slice(0,19));
await prisma.$disconnect();
