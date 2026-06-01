import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const schema = z.object({
  moveOutDate: z.string().datetime(),
  moveOutNoticedAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { organizationId, userId } = await requireOrg();
    const { id } = await params;
    const body = await req.json();
    const data = schema.parse(body);

    const lease = await prisma.lease.findFirst({
      where: { id, organizationId },
      include: {
        unit: { include: { property: true } },
        tenants: { include: { tenant: true }, where: { isPrimary: true }, take: 1 },
      },
    });
    if (!lease) return Response.json({ error: "Lease not found" }, { status: 404 });

    const moveOutDate = new Date(data.moveOutDate);
    const now = new Date();

    // Update lease with move-out dates
    const updated = await prisma.lease.update({
      where: { id },
      data: {
        moveOutDate,
        moveOutNoticedAt: data.moveOutNoticedAt ? new Date(data.moveOutNoticedAt) : null,
        // Mark as terminated if move-out date is today or past
        ...(moveOutDate <= now ? { status: "terminated" } : {}),
      },
    });

    // If move-out is today or past, mark unit as vacant
    if (moveOutDate <= now) {
      await prisma.unit.update({
        where: { id: lease.unitId },
        data: { status: "vacant" },
      });
    }

    // Log to activity timeline
    const tenant = lease.tenants[0]?.tenant;
    const tenantName = tenant ? `${tenant.firstName} ${tenant.lastName}` : "Tenant";
    await prisma.activityEvent.create({
      data: {
        organizationId,
        actorId: userId,
        entityType: "lease",
        entityId: id,
        eventType: "move_out_recorded",
        metadata: {
          moveOutDate: moveOutDate.toISOString(),
          moveOutNoticedAt: data.moveOutNoticedAt ?? null,
          tenantName,
          notes: data.notes ?? null,
        },
      },
    });

    // Create a follow-up task
    await prisma.task.create({
      data: {
        organizationId,
        title: `Move-out: ${tenantName} — ${lease.unit.property.name} Unit ${lease.unit.unitNumber}`,
        description: data.notes || `Move-out scheduled for ${moveOutDate.toLocaleDateString()}. Complete inspection, record deductions, return deposit.`,
        leaseId: id,
        dueDate: moveOutDate,
        priority: "high",
        status: "open",
        createdById: userId,
      },
    });

    return Response.json({
      ...updated,
      moveOutDate: updated.moveOutDate?.toISOString() ?? null,
      moveOutNoticedAt: updated.moveOutNoticedAt?.toISOString() ?? null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    console.error("[MOVE-OUT]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
