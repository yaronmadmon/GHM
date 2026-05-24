import { NextRequest } from 'next/server';
import { moraServiceGuard } from '@/lib/service-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const guard = moraServiceGuard(request);
  if (guard) return guard;

  const orgId = process.env.MORA_SERVICE_ORG_ID;
  if (!orgId) {
    return Response.json({ error: 'MORA_SERVICE_ORG_ID not configured on this server' }, { status: 500 });
  }

  try {
    const [propertyCount, activeLeasesCount, openMaintenanceCount, overduePaymentCount] =
      await Promise.all([
        prisma.property.count({ where: { organizationId: orgId, archivedAt: null } }),
        prisma.lease.count({ where: { organizationId: orgId, status: 'active' } }),
        prisma.maintenanceRequest.count({
          where: { organizationId: orgId, status: { in: ['open', 'in_progress'] } },
        }),
        prisma.rentPayment.count({
          where: { organizationId: orgId, status: 'overdue' },
        }),
      ]);

    return Response.json({
      ok: true,
      properties: propertyCount,
      activeLeases: activeLeasesCount,
      openMaintenance: openMaintenanceCount,
      overduePayments: overduePaymentCount,
    });
  } catch (err) {
    console.error('[mora-service] health check failed:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
