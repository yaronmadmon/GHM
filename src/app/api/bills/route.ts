import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const BILL_CATEGORIES = ["utility", "repair", "insurance", "tax", "mortgage", "hoa", "management", "legal", "other"] as const;
const BILL_STATUSES = ["needs_review", "approved", "paid", "overdue", "rejected"] as const;

const createSchema = z.object({
  vendorId: z.string().optional().nullable(),
  vendorName: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  documentId: z.string().optional().nullable(),
  amount: z.number().positive(),
  billDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  category: z.enum(BILL_CATEGORIES).default("other"),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(BILL_STATUSES).default("needs_review"),
});

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const propertyId = searchParams.get("propertyId");

    const bills = await prisma.bill.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
        ...(propertyId ? { propertyId } : {}),
      },
      include: {
        vendor: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    return Response.json(
      bills.map((b) => ({
        ...b,
        amount: Number(b.amount),
        billDate: b.billDate?.toISOString() ?? null,
        dueDate: b.dueDate?.toISOString() ?? null,
        paidAt: b.paidAt?.toISOString() ?? null,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
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

    const bill = await prisma.bill.create({
      data: {
        ...data,
        organizationId,
        createdById: userId,
        billDate: data.billDate ? new Date(data.billDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        amount: data.amount,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
    });

    return Response.json(
      {
        ...bill,
        amount: Number(bill.amount),
        billDate: bill.billDate?.toISOString() ?? null,
        dueDate: bill.dueDate?.toISOString() ?? null,
        paidAt: null,
        createdAt: bill.createdAt.toISOString(),
        updatedAt: bill.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
