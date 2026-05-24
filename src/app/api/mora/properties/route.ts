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
    const properties = await prisma.property.findMany({
      where: { organizationId: orgId, archivedAt: null },
      include: {
        units: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = properties.map((p) => ({
      id: p.id,
      name: p.name,
      address: [p.addressLine1, p.city, p.state, p.zip].filter(Boolean).join(', '),
      status: p.status,
      unitCount: p.units.length,
      vacantUnits: p.units.filter((u) => u.status === 'vacant').length,
    }));

    return Response.json(result);
  } catch (err) {
    console.error('[mora-service] properties failed:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
