import { NextRequest } from 'next/server';
import { moraServiceGuard } from '@/lib/service-auth';
import { prisma } from '@/lib/prisma';

type MaintenanceStatus = 'open' | 'in_progress' | 'pending_parts' | 'completed' | 'cancelled';

export async function GET(request: NextRequest) {
  const guard = moraServiceGuard(request);
  if (guard) return guard;

  const orgId = process.env.MORA_SERVICE_ORG_ID?.trim();
  if (!orgId) {
    return Response.json({ error: 'MORA_SERVICE_ORG_ID not configured on this server' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    // Support comma-separated values: "open,in_progress"
    const statuses = statusParam
      ? (statusParam.split(',').map((s) => s.trim()) as MaintenanceStatus[])
      : null;

    const requests = await prisma.maintenanceRequest.findMany({
      where: {
        organizationId: orgId,
        ...(statuses ? { status: { in: statuses } } : {}),
      },
      include: {
        property: true,
        unit: true,
        assignedVendor: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });

    const now = new Date();

    const result = requests.map((r) => {
      const unitLabel =
        r.property && r.unit
          ? `${r.property.name} â€” Unit ${r.unit.unitNumber}`
          : r.property?.name ?? 'Unknown Property';

      const daysOpen = Math.floor(
        (now.getTime() - new Date(r.createdAt).getTime()) / 86_400_000
      );

      return {
        id: r.id,
        title: r.title,
        description: r.description,
        priority: r.priority,
        status: r.status,
        category: r.category ?? 'other',
        unitLabel,
        propertyId: r.propertyId,
        assignedVendor: r.assignedVendor?.name ?? null,
        estimatedCost: r.estimatedCost ? Number(r.estimatedCost) : null,
        createdAt: r.createdAt.toISOString(),
        daysOpen,
      };
    });

    return Response.json(result);
  } catch (err) {
    console.error('[mora-service] maintenance failed:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
