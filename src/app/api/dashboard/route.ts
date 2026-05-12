import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { addDays } from "date-fns";
import { calculateLeaseBalance } from "@/lib/rent-ledger";

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
      activeRentLeases,
      maintenanceSummary,
      pendingApplications,
      recentActivity,
    ] = await Promise.all([
      // Property and unit counts
      prisma.property.findMany({
        where: { organizationId, archivedAt: null },
        include: { units: { select: { status: true } } },
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

      // Active rent roll with full ledger data
      prisma.lease.findMany({
        where: { organizationId, status: "active" },
        include: {
          rentPayments: true,
          transactions: true,
          unit: { include: { property: true } },
          tenants: { include: { tenant: true } },
        },
      }),

      // Maintenance by priority
      prisma.maintenanceRequest.groupBy({
        by: ["priority", "status"],
        where: { organizationId, status: { in: ["open", "in_progress"] } },
        _count: true,
      }),

      // Pending applications
      prisma.application.count({ where: { organizationId, status: "pending" } }),

      // Recent activity
      prisma.activityEvent.findMany({
        where: { organizationId },
        include: { actor: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    // Compute rent totals
    const totalExpected = activeRentLeases.reduce((sum, lease) => sum + Number(lease.rentAmount), 0);
    const totalCollected = activeRentLeases.reduce((sum, lease) => {
      const currentPayment = lease.rentPayments.find((p) => p.periodYear === currentYear && p.periodMonth === currentMonth);
      return sum + Number(currentPayment?.amountPaid ?? 0);
    }, 0);
    const overduePayments = activeRentLeases
      .map((lease) => ({
        lease,
        ledgerBalance: calculateLeaseBalance({
          rentPayments: lease.rentPayments,
          transactions: lease.transactions,
        }),
      }))
      .filter((item) => item.ledgerBalance > 0)
      .sort((a, b) => b.ledgerBalance - a.ledgerBalance);

    const propertyStats = {
      total: propertiesData.length,
      occupied: propertiesData.reduce((s, property) => s + property.units.filter((unit) => unit.status === "occupied").length, 0),
      vacant: propertiesData.reduce((s, property) => s + property.units.filter((unit) => unit.status === "vacant").length, 0),
      underMaintenance: propertiesData.reduce((s, property) => s + property.units.filter((unit) => unit.status === "under_maintenance").length, 0),
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
