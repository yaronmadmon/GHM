import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

    if (q.length < 2) return Response.json({ tenants: [], properties: [], maintenance: [], vendors: [] });

    const contains = { contains: q, mode: "insensitive" as const };

    const [tenants, properties, maintenance, vendors] = await Promise.all([
      // Tenants — search name, email, phone
      prisma.tenant.findMany({
        where: {
          organizationId,
          OR: [
            { firstName: contains },
            { lastName: contains },
            { email: contains },
            { phone: contains },
            // full name match: "john smith"
            {
              AND: [
                { firstName: { contains: q.split(" ")[0], mode: "insensitive" } },
                { lastName: { contains: q.split(" ").slice(1).join(" ") || q, mode: "insensitive" } },
              ],
            },
          ],
        },
        include: {
          leaseLinks: {
            where: { lease: { status: "active" } },
            include: { lease: { include: { unit: { include: { property: true } } } } },
            take: 1,
          },
        },
        take: 6,
      }),

      // Properties — search name, address, city
      prisma.property.findMany({
        where: {
          organizationId,
          archivedAt: null,
          OR: [
            { name: contains },
            { addressLine1: contains },
            { city: contains },
          ],
        },
        include: { _count: { select: { units: true } } },
        take: 5,
      }),

      // Maintenance — search title, description
      prisma.maintenanceRequest.findMany({
        where: {
          organizationId,
          OR: [
            { title: contains },
            { description: contains },
          ],
        },
        include: { property: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      // Vendors — search name, trade, phone
      prisma.vendor.findMany({
        where: {
          organizationId,
          OR: [
            { name: contains },
            { trade: contains },
            { phone: contains },
            { email: contains },
          ],
        },
        take: 4,
      }),
    ]);

    return Response.json({
      tenants: tenants.map((t) => {
        const lease = t.leaseLinks[0]?.lease;
        return {
          id: t.id,
          name: `${t.firstName} ${t.lastName}`,
          email: t.email,
          phone: t.phone,
          property: lease?.unit.property.name ?? null,
          unit: lease?.unit.unitNumber ?? null,
        };
      }),
      properties: properties.map((p) => ({
        id: p.id,
        name: p.name,
        address: `${p.addressLine1}, ${p.city}, ${p.state}`,
        unitCount: p._count.units,
        status: p.status,
      })),
      maintenance: maintenance.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        priority: m.priority,
        property: m.property?.name ?? null,
      })),
      vendors: vendors.map((v) => ({
        id: v.id,
        name: v.name,
        trade: v.trade,
        phone: v.phone,
      })),
    });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
