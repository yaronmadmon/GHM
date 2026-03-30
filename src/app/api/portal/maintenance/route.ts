import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function GET() {
  try {
    const { userId } = await requireOrg();

    const tenant = await prisma.tenant.findFirst({
      where: { portalUserId: userId },
      include: {
        leaseLinks: {
          include: {
            lease: {
              where: { status: "active" },
              include: { unit: true },
            },
          },
        },
      },
    });

    const activeLease = tenant?.leaseLinks.find((l) => l.lease?.status === "active")?.lease;
    const unitId = activeLease?.unit?.id ?? null;

    const requests = tenant
      ? await prisma.maintenanceRequest.findMany({
          where: { reportedByTenantId: tenant.id },
          orderBy: { createdAt: "desc" },
        })
      : [];

    return Response.json({ requests, unitId });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
