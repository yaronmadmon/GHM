import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const updateSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  rentAmount: z.number().positive().optional(),
  depositAmount: z.number().nullable().optional(),
  depositPaid: z.boolean().optional(),
  status: z.enum(["active", "expired", "terminated", "pending"]).optional(),
  leaseType: z.enum(["fixed", "month_to_month"]).optional(),
  lateFeeAmount: z.number().nullable().optional(),
  lateFeGraceDays: z.number().int().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;

    const lease = await prisma.lease.findFirst({
      where: { id, organizationId },
      include: {
        unit: { include: { property: true } },
        tenants: { include: { tenant: true } },
        documents: true,
        rentPayments: { orderBy: { dueDate: "desc" } },
      },
    });

    if (!lease) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(lease);
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

    const existing = await prisma.lease.findFirst({ where: { id, organizationId } });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    const { startDate, endDate, ...rest } = data;
    const lease = await prisma.lease.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      },
    });

    // If terminated, update unit status
    if (data.status === "terminated") {
      await prisma.unit.update({ where: { id: lease.unitId }, data: { status: "vacant" } });
    }

    return Response.json(lease);
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
