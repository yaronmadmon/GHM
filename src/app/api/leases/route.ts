import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";
import { addDays } from "date-fns";

const createSchema = z.object({
  unitId: z.string(),
  tenantIds: z.array(z.string()).min(1),
  startDate: z.string(),
  endDate: z.string().optional(),
  rentAmount: z.number().positive(),
  depositAmount: z.number().optional(),
  depositPaid: z.boolean().default(false),
  status: z.enum(["active", "expired", "terminated", "pending"]).default("active"),
  leaseType: z.enum(["fixed", "month_to_month"]).default("fixed"),
  paymentDueDay: z.number().int().min(1).max(28).default(1),
  lateFeeAmount: z.number().optional(),
  lateFeGraceDays: z.number().int().default(5),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const unitId = searchParams.get("unitId");
    const expiring = searchParams.get("expiring") === "true";

    const leases = await prisma.lease.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
        ...(unitId ? { unitId } : {}),
        ...(expiring ? {
          status: "active",
          endDate: {
            gte: new Date(),
            lte: addDays(new Date(), 60),
          },
        } : {}),
      },
      include: {
        unit: { include: { property: true } },
        tenants: { include: { tenant: true } },
        _count: { select: { rentPayments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(leases);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const body = await req.json();
    const data = createSchema.parse(body);

    const unit = await prisma.unit.findFirst({ where: { id: data.unitId, property: { organizationId } } });
    if (!unit) return Response.json({ error: "Unit not found" }, { status: 404 });

    const { tenantIds, startDate, endDate, rentAmount, depositAmount, ...rest } = data;

    const lease = await prisma.lease.create({
      data: {
        ...rest,
        organizationId,
        unitId: data.unitId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        rentAmount,
        depositAmount: depositAmount ?? undefined,
        tenants: {
          create: tenantIds.map((id, i) => ({ tenantId: id, isPrimary: i === 0 })),
        },
      },
      include: {
        unit: { include: { property: true } },
        tenants: { include: { tenant: true } },
      },
    });

    // Update unit status to occupied
    await prisma.unit.update({ where: { id: data.unitId }, data: { status: "occupied" } });

    await prisma.activityEvent.create({
      data: {
        organizationId,
        actorId: userId,
        entityType: "lease",
        entityId: lease.id,
        eventType: "created",
        metadata: { unit: unit.unitNumber, rentAmount },
      },
    });

    return Response.json(lease, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
