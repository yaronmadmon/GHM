import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const updateSchema = z.object({
  unitNumber: z.string().optional(),
  bedrooms: z.number().nullable().optional(),
  bathrooms: z.number().nullable().optional(),
  sqft: z.number().int().nullable().optional(),
  status: z.enum(["occupied", "vacant", "under_maintenance"]).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;

    const unit = await prisma.unit.findFirst({
      where: { id, property: { organizationId } },
      include: {
        property: true,
        leases: {
          include: { tenants: { include: { tenant: true } } },
          orderBy: { startDate: "desc" },
        },
        maintenanceRequests: { where: { status: { in: ["open", "in_progress"] } }, orderBy: { createdAt: "desc" } },
      },
    });

    if (!unit) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(unit);
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

    const existing = await prisma.unit.findFirst({ where: { id, property: { organizationId } } });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    const unit = await prisma.unit.update({ where: { id }, data });
    return Response.json(unit);
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;

    const existing = await prisma.unit.findFirst({ where: { id, property: { organizationId } } });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    await prisma.unit.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
