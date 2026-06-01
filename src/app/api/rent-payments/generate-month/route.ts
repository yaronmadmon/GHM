import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";
import { leaseMonthlyDueForPeriod } from "@/lib/monthly-charges";

const schema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
});

/** Returns the rent due date for a lease in a given period.
 *  Uses the lease's paymentDueDay (1–28), clamped to the last day of the month.
 */
function rentDueDate(year: number, month: number, paymentDueDay: number): Date {
  const lastDay = new Date(year, month, 0).getDate(); // last day of the month
  const day = Math.min(paymentDueDay, lastDay);
  return new Date(year, month - 1, day);
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const body = await req.json();
    const { year, month } = schema.parse(body);

    const activeLeases = await prisma.lease.findMany({
      where: { organizationId, status: "active" },
      include: { monthlyCharges: true },
    });

    let created = 0;
    for (const lease of activeLeases) {
      const amountDue = leaseMonthlyDueForPeriod(lease.rentAmount, lease.monthlyCharges, year, month);
      // Use the lease's actual payment due day, not always the 1st
      const dueDate = rentDueDate(year, month, lease.paymentDueDay ?? 1);
      await prisma.rentPayment.upsert({
        where: { leaseId_periodYear_periodMonth: { leaseId: lease.id, periodYear: year, periodMonth: month } },
        update: {},
        create: {
          organizationId,
          leaseId: lease.id,
          periodYear: year,
          periodMonth: month,
          amountDue,
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
