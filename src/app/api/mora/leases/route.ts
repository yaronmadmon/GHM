import { NextRequest } from 'next/server';
import { moraServiceGuard } from '@/lib/service-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const guard = moraServiceGuard(request);
  if (guard) return guard;

  const orgId = process.env.MORA_SERVICE_ORG_ID?.trim();
  if (!orgId) {
    return Response.json({ error: 'MORA_SERVICE_ORG_ID not configured on this server' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const expiringDaysParam = searchParams.get('expiringWithinDays');
    const expiringDays = expiringDaysParam ? parseInt(expiringDaysParam, 10) : null;

    const now = new Date();
    const expiryWindow =
      expiringDays && expiringDays > 0
        ? new Date(now.getTime() + expiringDays * 86_400_000)
        : null;

    const leases = await prisma.lease.findMany({
      where: {
        organizationId: orgId,
        ...(expiryWindow
          ? {
              status: 'active',
              endDate: { gte: now, lte: expiryWindow },
            }
          : status
            ? { status }
            : {}),
      },
      include: {
        unit: { include: { property: true } },
        tenants: { include: { tenant: true } },
      },
      orderBy: { endDate: 'asc' },
      take: 100,
    });

    const result = leases.map((l) => {
      const unit = l.unit;
      const property = unit?.property;
      const unitLabel =
        property && unit
          ? `${property.name} â€” Unit ${unit.unitNumber}`
          : property?.name ?? 'Unknown Property';

      const tenantNames = l.tenants.map(
        (lt) => `${lt.tenant.firstName} ${lt.tenant.lastName}`
      );
      const tenantEmails = l.tenants
        .map((lt) => lt.tenant.email ?? '')
        .filter(Boolean);

      const daysUntilExpiry = l.endDate
        ? Math.max(0, Math.floor((new Date(l.endDate).getTime() - now.getTime()) / 86_400_000))
        : 9999;

      return {
        id: l.id,
        unitLabel,
        tenantNames,
        tenantEmails,
        rentAmount: Number(l.rentAmount),
        startDate: l.startDate?.toISOString() ?? null,
        endDate: l.endDate?.toISOString() ?? null,
        status: l.status,
        leaseType: l.leaseType,
        daysUntilExpiry,
      };
    });

    return Response.json(result);
  } catch (err) {
    console.error('[mora-service] leases failed:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
