import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const STATUSES = ["new", "assigned", "waiting_estimate", "approved", "in_progress", "completed", "invoiced", "cancelled"] as const;

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  status: z.enum(STATUSES).optional(),
  estimatedCost: z.number().positive().optional().nullable(),
  actualCost: z.number().positive().optional().nullable(),
  vendorQuote: z.number().positive().optional().nullable(),
  vendorQuoteApprovedAt: z.string().datetime().optional().nullable(),
  scheduledDate: z.string().datetime().optional().nullable(),
  completedDate: z.string().datetime().optional().nullable(),
  invoiceUrl: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId } = await requireOrg();
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.workOrder.findFirst({ where: { id, organizationId } });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    // If completing, record completedDate
    const completedDate =
      data.status === "completed" && existing.status !== "completed"
        ? new Date()
        : data.completedDate
          ? new Date(data.completedDate)
          : existing.completedDate;

    // If completed with actualCost and propertyId, create expense transaction
    let transactionId = existing.transactionId;
    const acCost = data.actualCost ?? (existing.actualCost ? Number(existing.actualCost) : null);
    if (data.status === "completed" && existing.status !== "completed" && acCost && existing.propertyId && !transactionId) {
      const tx = await prisma.transaction.create({
        data: {
          organizationId,
          propertyId: existing.propertyId,
          type: "expense",
          category: "repair",
          amount: acCost,
          date: new Date(),
          description: existing.title,
          createdById: userId,
        },
      });
      transactionId = tx.id;
    }

    const workOrder = await prisma.workOrder.update({
      where: { id },
      data: {
        ...data,
        completedDate,
        transactionId,
        scheduledDate: data.scheduledDate === null ? null : data.scheduledDate ? new Date(data.scheduledDate) : undefined,
        vendorQuoteApprovedAt: data.vendorQuoteApprovedAt === null ? null : data.vendorQuoteApprovedAt ? new Date(data.vendorQuoteApprovedAt) : undefined,
      },
    });

    return Response.json({
      ...workOrder,
      estimatedCost: workOrder.estimatedCost !== null ? Number(workOrder.estimatedCost) : null,
      actualCost: workOrder.actualCost !== null ? Number(workOrder.actualCost) : null,
      vendorQuote: workOrder.vendorQuote !== null ? Number(workOrder.vendorQuote) : null,
      scheduledDate: workOrder.scheduledDate?.toISOString() ?? null,
      completedDate: workOrder.completedDate?.toISOString() ?? null,
      vendorQuoteApprovedAt: workOrder.vendorQuoteApprovedAt?.toISOString() ?? null,
      createdAt: workOrder.createdAt.toISOString(),
      updatedAt: workOrder.updatedAt.toISOString(),
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

    const existing = await prisma.workOrder.findFirst({ where: { id, organizationId } });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
    if (existing.status === "completed" || existing.status === "invoiced") {
      return Response.json({ error: "Cannot delete a completed work order" }, { status: 409 });
    }

    await prisma.workOrder.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
