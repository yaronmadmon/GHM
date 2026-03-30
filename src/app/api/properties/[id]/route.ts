import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().nullable().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  propertyType: z.enum(["single_family", "multi_unit", "condo", "commercial"]).optional(),
  status: z.enum(["occupied", "vacant", "under_maintenance"]).optional(),
  description: z.string().nullable().optional(),
  purchasePrice: z.number().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  archived: z.boolean().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;

    const property = await prisma.property.findFirst({
      where: { id, organizationId },
      include: {
        photos: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
        units: {
          include: {
            leases: {
              where: { status: "active" },
              include: { tenants: { include: { tenant: true } } },
            },
          },
        },
        _count: { select: { maintenanceRequests: { where: { status: { in: ["open", "in_progress"] } } } } },
      },
    });

    if (!property) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(property);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.property.findFirst({ where: { id, organizationId } });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    const { archived, purchaseDate, ...rest } = data;

    const property = await prisma.property.update({
      where: { id },
      data: {
        ...rest,
        ...(purchaseDate !== undefined ? { purchaseDate: purchaseDate ? new Date(purchaseDate) : null } : {}),
        ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
      },
    });

    return Response.json(property);
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;

    const existing = await prisma.property.findFirst({ where: { id, organizationId } });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    // Soft delete — archive instead of hard delete to preserve history
    await prisma.property.update({ where: { id }, data: { archivedAt: new Date() } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
