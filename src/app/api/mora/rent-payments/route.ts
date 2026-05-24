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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const payments = await prisma.rentPayment.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status } : {}),
      },
      include: {
        lease: {
          include: {
            unit: { include: { property: true } },
            tenants: {
              where: { isPrimary: true },
              include: { tenant: true },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      take: 100,
    });

    const now = new Date();

    const result = payments.map((p) => {
      const primaryTenant = p.lease.tenants[0]?.tenant;
      const unit = p.lease.unit;
      const property = unit?.property;
      const unitLabel =
        property && unit
          ? `${property.name} — Unit ${unit.unitNumber}`
          : property?.name ?? 'Unknown Property';

      const daysOverdue =
        p.status === 'overdue' && p.dueDate
          ? Math.max(0, Math.floor((now.getTime() - new Date(p.dueDate).getTime()) / 86_400_000))
          : 0;

      return {
        id: p.id,
        leaseId: p.leaseId,
        tenantName: primaryTenant
          ? `${primaryTenant.firstName} ${primaryTenant.lastName}`
          : 'Unknown Tenant',
        tenantEmail: primaryTenant?.email ?? '',
        unitLabel,
        periodYear: p.periodYear,
        periodMonth: p.periodMonth,
        amountDue: Number(p.amountDue),
        amountPaid: Number(p.amountPaid),
        status: p.status,
        dueDate: p.dueDate?.toISOString() ?? null,
        daysOverdue,
      };
    });

    return Response.json(result);
  } catch (err) {
    console.error('[mora-service] rent-payments failed:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
