import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const STATUSES = ["scheduled", "in_progress", "completed", "cancelled"] as const;
const CONDITIONS = ["excellent", "good", "fair", "poor"] as const;

const updateSchema = z.object({
  status: z.enum(STATUSES).optional(),
  scheduledDate: z.string().datetime().optional().nullable(),
  completedDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  checklist: z.any().optional().nullable(),
  overallCondition: z.enum(CONDITIONS).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.inspection.findFirst({ where: { id, organizationId } });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    const completedDate =
      data.status === "completed" && existing.status !== "completed"
        ? new Date()
        : data.completedDate
          ? new Date(data.completedDate)
          : existing.completedDate;

    const inspection = await prisma.inspection.update({
      where: { id },
      data: {
        ...data,
        completedDate,
        scheduledDate: data.scheduledDate === null ? null : data.scheduledDate ? new Date(data.scheduledDate) : undefined,
        checklist: data.checklist !== undefined ? data.checklist : undefined,
      },
    });

    return Response.json({
      ...inspection,
      scheduledDate: inspection.scheduledDate?.toISOString() ?? null,
      completedDate: inspection.completedDate?.toISOString() ?? null,
      createdAt: inspection.createdAt.toISOString(),
      updatedAt: inspection.updatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;

    const existing = await prisma.inspection.findFirst({ where: { id, organizationId } });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
    if (existing.status === "completed") {
      return Response.json({ error: "Cannot delete a completed inspection" }, { status: 409 });
    }

    await prisma.inspection.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
