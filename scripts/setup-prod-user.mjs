/**
 * Converts the dev placeholder account (dev@ghm.local) to a real account
 * with the owner's email and a proper password, so production login works.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const EMAIL    = "yaronmadmon@gmail.com";
const PASSWORD = "GHM@2026!";

const prisma = new PrismaClient();

const hash = await bcrypt.hash(PASSWORD, 12);

const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
if (!user) { console.error("No user found"); process.exit(1); }

await prisma.user.update({
  where: { id: user.id },
  data: { email: EMAIL, name: "Yaron", passwordHash: hash },
});

console.log("✓ Updated account:");
console.log("  Email:   ", EMAIL);
console.log("  Password:", PASSWORD);
console.log("  Org ID:  ", user.organizationId);

await prisma.$disconnect();
