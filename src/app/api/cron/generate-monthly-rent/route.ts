import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { leaseMonthlyDueForPeriod } from "@/lib/monthly-charges";

function rentDueDate(year: number, month: number, paymentDueDay: number): Date {
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(paymentDueDay, lastDay));
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  console.log(`[CRON] Generating rent for ${year}-${month}`);

  // Get all active leases across all orgs
  const activeLeases = await prisma.lease.findMany({
    where: { status: "active" },
    include: { monthlyCharges: true },
  });

  let created = 0;

  for (const lease of activeLeases) {
    const amountDue = leaseMonthlyDueForPeriod(
      lease.rentAmount,
      lease.monthlyCharges,
      year,
      month,
    );
    // Use the lease's configured payment due day, not always the 1st
    const dueDate = rentDueDate(year, month, lease.paymentDueDay ?? 1);
    const result = await prisma.rentPayment.upsert({
      where: { leaseId_periodYear_periodMonth: { leaseId: lease.id, periodYear: year, periodMonth: month } },
      update: {},
      create: {
        organizationId: lease.organizationId,
        leaseId: lease.id,
        periodYear: year,
        periodMonth: month,
        amountDue,
        amountPaid: 0,
        status: "pending",
        dueDate,
      },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
  }

  // Notify org owners that rent charges have been generated
  if (created > 0) {
    const orgIds = [...new Set(activeLeases.map((l) => l.organizationId))];
    for (const orgId of orgIds) {
      const orgLeaseCount = activeLeases.filter((l) => l.organizationId === orgId).length;
      const users = await prisma.user.findMany({
        where: { organizationId: orgId, role: { in: ["owner", "member"] } },
        select: { id: true },
      });
      await createNotifications(
        users.map((u) => ({
          userId: u.id,
          type: "payment_due" as const,
          title: "Monthly rent generated",
          body: `${orgLeaseCount} rent charge${orgLeaseCount !== 1 ? "s" : ""} created for ${new Date(year, month - 1).toLocaleString("en-US", { month: "long", year: "numeric" })}.`,
          relatedUrl: "/rent",
        })),
      );
    }
  }

  console.log(`[CRON] Created ${created} new rent payment records for ${year}-${month}`);
  return Response.json({ created, total: activeLeases.length, period: `${year}-${month}` });
}
