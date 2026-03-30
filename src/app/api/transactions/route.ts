import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const createSchema = z.object({
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  leaseId: z.string().optional(),
  type: z.enum(["income", "expense"]),
  category: z.string(),
  amount: z.number().positive(),
  date: z.string(),
  description: z.string().optional(),
  paymentMethod: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId");
    const type = searchParams.get("type");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const transactions = await prisma.transaction.findMany({
      where: {
        organizationId,
        ...(propertyId ? { propertyId } : {}),
        ...(type ? { type } : {}),
        ...(from || to ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        } : {}),
      },
      include: { property: true, unit: true },
      orderBy: { date: "desc" },
    });

    return Response.json(transactions);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const body = await req.json();
    const data = createSchema.parse(body);

    const transaction = await prisma.transaction.create({
      data: {
        ...data,
        organizationId,
        date: new Date(data.date),
        createdById: userId,
      },
    });

    return Response.json(transaction, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
