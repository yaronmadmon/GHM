import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

// Maps charge type to Transaction category + income/expense direction
const CHARGE_MAP: Record<string, { category: string; txType: "income" | "expense" }> = {
  late_fee:                   { category: "late_fee", txType: "income" },
  repair_chargeback:          { category: "repair",   txType: "income" },
  utility_reimbursement:      { category: "utility",  txType: "income" },
  nsf_fee:                    { category: "late_fee", txType: "income" },
  returned_payment_fee:       { category: "late_fee", txType: "income" },
  legal_fee:                  { category: "other",    txType: "income" },
  court_fee:                  { category: "other",    txType: "income" },
  attorney_fee:               { category: "other",    txType: "income" },
  security_deposit_deduction: { category: "deposit",  txType: "income" },
  credit:                     { category: "other",    txType: "expense" }, // reduces balance
  other:                      { category: "other",    txType: "income" },
};

export const CHARGE_TYPES = Object.keys(CHARGE_MAP);

const createSchema = z.object({
  leaseId: z.string(),
  chargeType: z.enum(CHARGE_TYPES as [string, ...string[]]),
  amount: z.number().positive(),
  date: z.string().datetime(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const leaseId = searchParams.get("leaseId");
    if (!leaseId) return Response.json({ error: "leaseId required" }, { status: 400 });

    const charges = await prisma.transaction.findMany({
      where: {
        organizationId,
        leaseId,
        category: { not: "rent" },
      },
      orderBy: { date: "desc" },
    });

    return Response.json(
      charges.map((c) => ({
        ...c,
        amount: Number(c.amount),
        date: c.date.toISOString(),
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
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

    // Confirm the lease belongs to this org
    const lease = await prisma.lease.findFirst({
      where: { id: data.leaseId, organizationId },
      select: { id: true, unitId: true, unit: { select: { propertyId: true } } },
    });
    if (!lease) return Response.json({ error: "Lease not found" }, { status: 404 });

    const mapping = CHARGE_MAP[data.chargeType];
    const charge = await prisma.transaction.create({
      data: {
        organizationId,
        leaseId: data.leaseId,
        propertyId: lease.unit?.propertyId ?? null,
        unitId: lease.unitId,
        type: mapping.txType,
        category: mapping.category,
        amount: data.amount,
        date: new Date(data.date),
        description: data.description || data.chargeType.replace(/_/g, " "),
        createdById: userId,
      },
    });

    return Response.json(
      {
        ...charge,
        amount: Number(charge.amount),
        date: charge.date.toISOString(),
        createdAt: charge.createdAt.toISOString(),
        updatedAt: charge.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
