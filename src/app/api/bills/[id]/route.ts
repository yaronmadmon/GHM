import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const BILL_CATEGORIES = ["utility", "repair", "insurance", "tax", "mortgage", "hoa", "management", "legal", "other"] as const;
const BILL_STATUSES = ["needs_review", "approved", "paid", "overdue", "rejected"] as const;
const TX_CATEGORY: Record<string, string> = {
  utility: "utility", repair: "repair", insurance: "insurance",
  tax: "tax", mortgage: "other", hoa: "management",
  management: "management", legal: "other", other: "other",
};

const updateSchema = z.object({
  vendorId: z.string().optional().nullable(),
  vendorName: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  amount: z.number().positive().optional(),
  billDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  category: z.enum(BILL_CATEGORIES).optional(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(BILL_STATUSES).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId } = await requireOrg();
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.bill.findFirst({ where: { id, organizationId } });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    // Guard: already paid → block re-payment
    if (data.status === "paid" && existing.status === "paid") {
      return Response.json({ error: "Bill is already paid" }, { status: 409 });
    }

    // Guard: unpaid with existing transaction → block (shouldn't happen, but be safe)
    if (data.status === "paid" && existing.status !== "paid") {
      if (existing.transactionId) {
        return Response.json({ error: "Bill already has a linked transaction" }, { status: 409 });
      }

      // Create expense transaction atomically
      const txAmount = data.amount ?? Number(existing.amount);
      const txDate = data.billDate ? new Date(data.billDate) : existing.billDate ?? new Date();
      const txCategory = TX_CATEGORY[data.category ?? existing.category] ?? "other";
      const txPropertyId = data.propertyId ?? existing.propertyId;
      const txDescription = data.description ?? existing.description
        ?? data.vendorName ?? existing.vendorName
        ?? "Bill payment";

      const [tx, bill] = await prisma.$transaction([
        prisma.transaction.create({
          data: {
            organizationId,
            propertyId: txPropertyId ?? undefined,
            type: "expense",
            category: txCategory,
            amount: txAmount,
            date: txDate,
            description: typeof txDescription === "string" ? txDescription : undefined,
            createdById: userId,
          },
        }),
        prisma.bill.update({
          where: { id },
          data: {
            ...data,
            billDate: data.billDate ? new Date(data.billDate) : undefined,
            dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
            paidAt: new Date(),
            paidById: userId,
          },
          include: {
            vendor: { select: { id: true, name: true } },
            property: { select: { id: true, name: true } },
          },
        }),
      ]);

      // Store transactionId on the bill
      const finalBill = await prisma.bill.update({
        where: { id },
        data: { transactionId: tx.id },
        include: {
          vendor: { select: { id: true, name: true } },
          property: { select: { id: true, name: true } },
        },
      });

      return Response.json({
        ...finalBill,
        amount: Number(finalBill.amount),
        billDate: finalBill.billDate?.toISOString() ?? null,
        dueDate: finalBill.dueDate?.toISOString() ?? null,
        paidAt: finalBill.paidAt?.toISOString() ?? null,
        createdAt: finalBill.createdAt.toISOString(),
        updatedAt: finalBill.updatedAt.toISOString(),
      });
    }

    const bill = await prisma.bill.update({
      where: { id },
      data: {
        ...data,
        billDate: data.billDate === null ? null : data.billDate ? new Date(data.billDate) : undefined,
        dueDate: data.dueDate === null ? null : data.dueDate ? new Date(data.dueDate) : undefined,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
    });

    return Response.json({
      ...bill,
      amount: Number(bill.amount),
      billDate: bill.billDate?.toISOString() ?? null,
      dueDate: bill.dueDate?.toISOString() ?? null,
      paidAt: bill.paidAt?.toISOString() ?? null,
      createdAt: bill.createdAt.toISOString(),
      updatedAt: bill.updatedAt.toISOString(),
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

    const existing = await prisma.bill.findFirst({ where: { id, organizationId } });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
    if (existing.status === "paid") {
      return Response.json({ error: "Cannot delete a paid bill. Reject it instead." }, { status: 409 });
    }

    await prisma.bill.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
