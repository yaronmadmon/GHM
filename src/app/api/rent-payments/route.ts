import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const createSchema = z.object({
  leaseId: z.string(),
  periodYear: z.number().int(),
  periodMonth: z.number().int().min(1).max(12),
  amountDue: z.number().positive(),
  amountPaid: z.number().min(0),
  dueDate: z.string(),
  paidAt: z.string().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const leaseId = searchParams.get("leaseId");
    const status = searchParams.get("status");
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined;
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : undefined;

    const payments = await prisma.rentPayment.findMany({
      where: {
        organizationId,
        ...(leaseId ? { leaseId } : {}),
        ...(status ? { status } : {}),
        ...(year ? { periodYear: year } : {}),
        ...(month ? { periodMonth: month } : {}),
      },
      include: {
        lease: {
          include: {
            unit: { include: { property: true } },
            tenants: { include: { tenant: true } },
          },
        },
      },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });

    return Response.json(payments);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const body = await req.json();
    const data = createSchema.parse(body);

    const lease = await prisma.lease.findFirst({ where: { id: data.leaseId, organizationId } });
    if (!lease) return Response.json({ error: "Lease not found" }, { status: 404 });

    const amountPaid = data.amountPaid;
    const amountDue = data.amountDue;
    let status = "pending";
    if (amountPaid >= amountDue) status = "paid";
    else if (amountPaid > 0) status = "partial";
    else if (new Date(data.dueDate) < new Date()) status = "overdue";

    const payment = await prisma.rentPayment.upsert({
      where: { leaseId_periodYear_periodMonth: { leaseId: data.leaseId, periodYear: data.periodYear, periodMonth: data.periodMonth } },
      update: { amountPaid, status, paidAt: data.paidAt ? new Date(data.paidAt) : status === "paid" ? new Date() : undefined, paymentMethod: data.paymentMethod, notes: data.notes, recordedById: userId },
      create: {
        ...data,
        organizationId,
        status,
        dueDate: new Date(data.dueDate),
        paidAt: data.paidAt ? new Date(data.paidAt) : status === "paid" ? new Date() : undefined,
        recordedById: userId,
      },
    });

    // Log transaction when payment is made
    if (amountPaid > 0) {
      await prisma.transaction.create({
        data: {
          organizationId,
          leaseId: data.leaseId,
          type: "income",
          category: "rent",
          amount: amountPaid,
          date: payment.paidAt ?? new Date(),
          description: `Rent payment ${data.periodYear}-${String(data.periodMonth).padStart(2, "0")}`,
          paymentMethod: data.paymentMethod,
          referenceId: payment.id,
          createdById: userId,
        },
      });
    }

    await prisma.activityEvent.create({
      data: {
        organizationId,
        actorId: userId,
        entityType: "payment",
        entityId: payment.id,
        eventType: "payment_recorded",
        metadata: { amount: amountPaid, status, period: `${data.periodYear}-${data.periodMonth}` },
      },
    });

    return Response.json(payment, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
