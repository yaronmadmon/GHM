import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["rent", "utility", "parking", "pet_fee", "storage", "other"]).default("other"),
  amount: z.number().positive(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;
    const body = await req.json();
    const data = createSchema.parse(body);

    const lease = await prisma.lease.findFirst({ where: { id, organizationId } });
    if (!lease) return Response.json({ error: "Lease not found" }, { status: 404 });

    const charge = await prisma.leaseMonthlyCharge.create({
      data: {
        leaseId: id,
        name: data.name,
        category: data.category,
        amount: data.amount,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        notes: data.notes || null,
      },
    });

    return Response.json(charge, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
