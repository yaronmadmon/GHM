import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// In dev with SKIP_AUTH=true, auto-returns the first org user (creates org+user if none exist)
async function getDevSession() {
  let user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({
        data: { name: "My Properties" },
      });
    }
    user = await prisma.user.create({
      data: {
        email: "dev@ghm.local",
        name: "Dev User",
        role: "admin",
        organizationId: org.id,
        passwordHash: "",
      },
    });
  }
  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      name: user.name,
      organizationId: user.organizationId,
      role: user.role,
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function getSession() {
  if (process.env.SKIP_AUTH === "true") return getDevSession();
  return auth() as Promise<{ user: { id: string; email: string; name: string | null; organizationId: string; role: string } } | null>;
}

export async function requireOrg() {
  const session = await getSession();
  if (!session?.user?.organizationId) throw new Error("Unauthorized");
  return {
    userId: session.user.id,
    organizationId: session.user.organizationId,
    role: session.user.role,
  };
}

export async function requireOrgOrNull() {
  try {
    return await requireOrg();
  } catch {
    return null;
  }
}
