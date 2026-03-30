import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const createSchema = z.object({
  leaseId: z.string(),
  amount: z.number().positive(),
  method: z.enum(["cash", "check", "ach", "zelle", "venmo", "other"]),
  notes: z.string().optional(),
  periodYear: z.number().int(),
  periodMonth: z.number().int().min(1).max(12),
});

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const requests = await prisma.paymentRequest.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(requests);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const body = await req.json();
    const data = createSchema.parse(body);

    const request = await prisma.paymentRequest.create({
      data: {
        ...data,
        organizationId,
        tenantUserId: userId,
        amount: data.amount,
      },
    });
    return Response.json(request, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
