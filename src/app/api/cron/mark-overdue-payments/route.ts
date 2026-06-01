import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { differenceInDays, startOfMonth, endOfMonth } from "date-fns";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Fetch pending overdue payments WITH their lease data for late fee logic
  const overduePayments = await prisma.rentPayment.findMany({
    where: { status: "pending", dueDate: { lt: now } },
    include: {
      lease: {
        select: {
          id: true,
          organizationId: true,
          unitId: true,
          unit: { select: { propertyId: true } },
          lateFeeAmount: true,
          lateFeGraceDays: true,
        },
      },
    },
  });

  if (overduePayments.length === 0) {
    return Response.json({ updated: 0, lateFeesApplied: 0 });
  }

  // Mark them overdue
  const result = await prisma.rentPayment.updateMany({
    where: { status: "pending", dueDate: { lt: now } },
    data: { status: "overdue" },
  });

  console.log(`[CRON] Marked ${result.count} payments as overdue`);

  // Apply late fees — only for leases that have a lateFeeAmount configured
  let lateFeesApplied = 0;
  for (const payment of overduePayments) {
    const lease = payment.lease;
    const lateFeeAmount = lease.lateFeeAmount ? Number(lease.lateFeeAmount) : 0;
    if (lateFeeAmount <= 0) continue; // this tenant's lease has no late fee — skip

    const graceDays = lease.lateFeGraceDays ?? 5;
    const daysOverdue = differenceInDays(now, payment.dueDate);
    if (daysOverdue < graceDays) continue; // still within grace period

    // Check if late fee already applied for this period (avoid double-charging)
    const periodStart = startOfMonth(payment.dueDate);
    const periodEnd = endOfMonth(payment.dueDate);
    const existing = await prisma.transaction.findFirst({
      where: {
        leaseId: lease.id,
        category: "late_fee",
        date: { gte: periodStart, lte: periodEnd },
      },
    });
    if (existing) continue; // already charged this month

    // Apply the late fee as an income transaction on the lease
    const monthLabel = payment.dueDate.toLocaleString("en-US", { month: "long", year: "numeric" });
    await prisma.transaction.create({
      data: {
        organizationId: lease.organizationId,
        leaseId: lease.id,
        propertyId: lease.unit?.propertyId ?? null,
        type: "income",
        category: "late_fee",
        amount: lateFeeAmount,
        date: now,
        description: `Late fee — ${monthLabel}`,
      },
    });
    lateFeesApplied++;
  }

  if (lateFeesApplied > 0) {
    console.log(`[CRON] Applied ${lateFeesApplied} late fee charges`);
  }

  // Notify landlords by org
  const countByOrg = new Map<string, number>();
  for (const p of overduePayments) {
    const orgId = p.organizationId;
    countByOrg.set(orgId, (countByOrg.get(orgId) ?? 0) + 1);
  }
  for (const [orgId, count] of countByOrg) {
    const users = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    createNotifications(
      users.map((u) => ({
        userId: u.id,
        type: "payment_due" as const,
        title: "Overdue rent",
        body: `${count} payment${count === 1 ? "" : "s"} marked overdue${lateFeesApplied > 0 ? `, ${lateFeesApplied} late fee${lateFeesApplied > 1 ? "s" : ""} applied` : ""}`,
        relatedUrl: "/rent",
      })),
    );
  }

  return Response.json({ updated: result.count, lateFeesApplied });
}
