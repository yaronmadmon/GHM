import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { organizationId } = await requireOrg();
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { stripeAccountId: true },
    });
    return Response.json({ connected: !!org?.stripeAccountId, accountId: org?.stripeAccountId ?? null });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE() {
  try {
    const { organizationId } = await requireOrg();
    await prisma.organization.update({
      where: { id: organizationId },
      data: { stripeAccountId: null },
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
