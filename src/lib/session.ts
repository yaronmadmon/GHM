import { auth } from "@/lib/auth";

export async function requireOrg() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }
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
