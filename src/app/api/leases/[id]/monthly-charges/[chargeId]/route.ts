import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(["rent", "utility", "parking", "pet_fee", "storage", "other"]).optional(),
  amount: z.number().positive().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; chargeId: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id, chargeId } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.leaseMonthlyCharge.findFirst({
      where: { id: chargeId, lease: { id, organizationId } },
    });
    if (!existing) return Response.json({ error: "Charge not found" }, { status: 404 });

    const { startDate, endDate, ...rest } = data;
    const charge = await prisma.leaseMonthlyCharge.update({
      where: { id: chargeId },
      data: {
        ...rest,
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      },
    });

    return Response.json(charge);
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; chargeId: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id, chargeId } = await params;
    const existing = await prisma.leaseMonthlyCharge.findFirst({
      where: { id: chargeId, lease: { id, organizationId } },
    });
    if (!existing) return Response.json({ error: "Charge not found" }, { status: 404 });

    await prisma.leaseMonthlyCharge.delete({ where: { id: chargeId } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
