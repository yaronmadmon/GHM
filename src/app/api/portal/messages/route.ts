import { requirePortalSession } from "@/lib/portal-session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requirePortalSession();
    const tenant = session.tenant;

    const threads = await prisma.messageThread.findMany({
      where: {
        OR: [
          { tenantUserId: tenant.id },
          ...(tenant.portalUserId ? [{ tenantUserId: tenant.portalUserId }] : []),
        ],
      },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    return Response.json(threads);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
