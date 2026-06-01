import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const STATUSES = ["new", "assigned", "waiting_estimate", "approved", "in_progress", "completed", "invoiced", "cancelled"] as const;

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  maintenanceRequestId: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  estimatedCost: z.number().positive().optional().nullable(),
  scheduledDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(STATUSES).default("new"),
});

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const propertyId = searchParams.get("propertyId");

    const workOrders = await prisma.workOrder.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
        ...(propertyId ? { propertyId } : {}),
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    return Response.json(
      workOrders.map((w) => ({
        ...w,
        estimatedCost: w.estimatedCost !== null ? Number(w.estimatedCost) : null,
        actualCost: w.actualCost !== null ? Number(w.actualCost) : null,
        vendorQuote: w.vendorQuote !== null ? Number(w.vendorQuote) : null,
        scheduledDate: w.scheduledDate?.toISOString() ?? null,
        completedDate: w.completedDate?.toISOString() ?? null,
        vendorQuoteApprovedAt: w.vendorQuoteApprovedAt?.toISOString() ?? null,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      })),
    );
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const body = await req.json();
    const data = createSchema.parse(body);

    const workOrder = await prisma.workOrder.create({
      data: {
        ...data,
        organizationId,
        createdById: userId,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
      },
    });

    return Response.json(
      {
        ...workOrder,
        estimatedCost: workOrder.estimatedCost !== null ? Number(workOrder.estimatedCost) : null,
        actualCost: null,
        vendorQuote: null,
        scheduledDate: workOrder.scheduledDate?.toISOString() ?? null,
        completedDate: null,
        vendorQuoteApprovedAt: null,
        createdAt: workOrder.createdAt.toISOString(),
        updatedAt: workOrder.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
