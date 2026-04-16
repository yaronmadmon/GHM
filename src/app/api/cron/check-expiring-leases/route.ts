import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { addDays } from "date-fns";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expiringSoon = await prisma.lease.findMany({
    where: {
      status: "active",
      endDate: { gte: new Date(), lte: addDays(new Date(), 60) },
    },
    include: {
      unit: { include: { property: true } },
      tenants: { include: { tenant: true } },
    },
  });

  console.log(`[CRON] Found ${expiringSoon.length} leases expiring within 60 days`);

  // Notify all landlord users in each affected organization
  if (expiringSoon.length > 0) {
    const orgIds = [...new Set(expiringSoon.map((l) => l.unit.property.organizationId ?? l.organizationId))];
    const landlords = await prisma.user.findMany({
      where: { organizationId: { in: orgIds }, role: { in: ["owner", "member"] } },
      select: { id: true, organizationId: true },
    });

    const notifs = expiringSoon.flatMap((lease) => {
      const tenant = lease.tenants[0]?.tenant;
      const daysLeft = Math.ceil((new Date(lease.endDate!).getTime() - Date.now()) / 86400000);
      const tenantName = tenant ? `${tenant.firstName} ${tenant.lastName}` : "A tenant";
      return landlords
        .filter((u) => u.organizationId === lease.organizationId)
        .map((u) => ({
          userId: u.id,
          type: "lease_expiry" as const,
          title: "Lease expiring soon",
          body: `${tenantName}'s lease expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.`,
          relatedUrl: `/leases`,
        }));
    });

    await createNotifications(notifs);
  }

  return Response.json({ processed: expiringSoon.length });
}
