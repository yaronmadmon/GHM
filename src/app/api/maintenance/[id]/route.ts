import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "emergency"]).optional(),
  status: z.enum(["open", "in_progress", "pending_parts", "completed", "cancelled"]).optional(),
  category: z.string().nullable().optional(),
  assignedVendorId: z.string().nullable().optional(),
  estimatedCost: z.number().nullable().optional(),
  actualCost: z.number().nullable().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;

    const request = await prisma.maintenanceRequest.findFirst({
      where: { id, organizationId },
      include: {
        property: true,
        unit: true,
        assignedVendor: true,
        reportedByTenant: true,
        comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
        photos: true,
      },
    });

    if (!request) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(request);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId } = await requireOrg();
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.maintenanceRequest.findFirst({ where: { id, organizationId } });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    const request = await prisma.maintenanceRequest.update({
      where: { id },
      data: {
        ...data,
        ...(data.status === "completed" ? { resolvedAt: new Date() } : {}),
      },
    });

    if (data.status && data.status !== existing.status) {
      await prisma.activityEvent.create({
        data: {
          organizationId,
          actorId: userId,
          entityType: "maintenance",
          entityId: id,
          eventType: "status_changed",
          metadata: { from: existing.status, to: data.status },
        },
      });
    }

    return Response.json(request);
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
