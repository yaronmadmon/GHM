import { prisma } from "@/lib/prisma";
import { requirePortalSession } from "@/lib/portal-session";

export async function GET() {
  try {
    const session = await requirePortalSession();
    const lease = session.tenant.leaseLinks[0]?.lease;
    if (!lease) return Response.json([]);

    const payments = await prisma.rentPayment.findMany({
      where: { leaseId: lease.id },
      orderBy: { dueDate: "desc" },
    });

    return Response.json(payments);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
