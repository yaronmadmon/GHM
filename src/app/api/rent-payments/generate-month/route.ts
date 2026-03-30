import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const schema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
});

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const body = await req.json();
    const { year, month } = schema.parse(body);

    const activeLeases = await prisma.lease.findMany({
      where: { organizationId, status: "active" },
    });

    const dueDate = new Date(year, month - 1, 1);

    let created = 0;
    for (const lease of activeLeases) {
      await prisma.rentPayment.upsert({
        where: { leaseId_periodYear_periodMonth: { leaseId: lease.id, periodYear: year, periodMonth: month } },
        update: {},
        create: {
          organizationId,
          leaseId: lease.id,
          periodYear: year,
          periodMonth: month,
          amountDue: lease.rentAmount,
          amountPaid: 0,
          status: "pending",
          dueDate,
        },
      });
      created++;
    }

    return Response.json({ created, message: `Generated ${created} payment records for ${year}-${month}` });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
