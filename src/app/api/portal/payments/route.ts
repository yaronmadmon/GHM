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
              include: {
                rentPayments: { orderBy: { dueDate: "desc" }, take: 24 },
              },
            },
          },
        },
      },
    });

    const activeLease = tenant?.leaseLinks.find((l) => l.lease?.status === "active")?.lease;
    const payments = activeLease?.rentPayments ?? [];

    const requests = activeLease
      ? await prisma.paymentRequest.findMany({
          where: { leaseId: activeLease.id, tenantUserId: userId },
          orderBy: { createdAt: "desc" },
        })
      : [];

    return Response.json({ payments, leaseId: activeLease?.id ?? null, requests });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
