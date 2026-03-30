import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { addDays } from "date-fns";

export async function GET() {
  try {
    const { organizationId } = await requireOrg();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const [
      propertiesData,
      expiringLeases,
      overduePayments,
      maintenanceSummary,
      pendingApplications,
      monthPayments,
      recentActivity,
    ] = await Promise.all([
      // Property counts
      prisma.property.groupBy({
        by: ["status"],
        where: { organizationId, archivedAt: null },
        _count: true,
      }),

      // Leases expiring in 60 days
      prisma.lease.findMany({
        where: {
          organizationId,
          status: "active",
          endDate: { gte: now, lte: addDays(now, 60) },
        },
        include: {
          unit: { include: { property: true } },
          tenants: { include: { tenant: true } },
        },
        orderBy: { endDate: "asc" },
      }),

      // Overdue payments
      prisma.rentPayment.findMany({
        where: { organizationId, status: "overdue" },
        include: {
          lease: {
            include: {
              unit: { include: { property: true } },
              tenants: { include: { tenant: true } },
            },
          },
        },
        orderBy: { amountDue: "desc" },
      }),

      // Maintenance by priority
      prisma.maintenanceRequest.groupBy({
        by: ["priority", "status"],
        where: { organizationId, status: { in: ["open", "in_progress"] } },
        _count: true,
      }),

      // Pending applications
      prisma.application.count({ where: { organizationId, status: "pending" } }),

      // This month's payments
      prisma.rentPayment.findMany({
        where: { organizationId, periodYear: currentYear, periodMonth: currentMonth },
      }),

      // Recent activity
      prisma.activityEvent.findMany({
        where: { organizationId },
        include: { actor: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    // Compute rent totals
    const totalExpected = monthPayments.reduce((sum, p) => sum + Number(p.amountDue), 0);
    const totalCollected = monthPayments.reduce((sum, p) => sum + Number(p.amountPaid), 0);

    const propertyStats = {
      total: propertiesData.reduce((s, g) => s + g._count, 0),
      occupied: propertiesData.find((g) => g.status === "occupied")?._count ?? 0,
      vacant: propertiesData.find((g) => g.status === "vacant")?._count ?? 0,
      underMaintenance: propertiesData.find((g) => g.status === "under_maintenance")?._count ?? 0,
    };

    const maintenanceStats = maintenanceSummary.reduce((acc, g) => {
      acc[g.priority] = (acc[g.priority] ?? 0) + g._count;
      return acc;
    }, {} as Record<string, number>);

    return Response.json({
      properties: propertyStats,
      rent: { totalExpected, totalCollected, collectionRate: totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0 },
      overduePayments,
      expiringLeases,
      maintenance: maintenanceStats,
      pendingApplications,
      recentActivity,
      generatedAt: now,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
