import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { calculateLeaseBalance } from "@/lib/rent-ledger";
import { leaseMonthlyDueForPeriod } from "@/lib/monthly-charges";

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

    // Get all active leases with their units/properties
    const activeLeases = await prisma.lease.findMany({
      where: { organizationId, status: "active" },
      include: {
        unit: { include: { property: true } },
        tenants: { include: { tenant: true } },
        rentPayments: true,
        transactions: true,
        monthlyCharges: true,
      },
      orderBy: [{ unit: { property: { name: "asc" } } }, { unit: { unitNumber: "asc" } }],
    });

    const result = activeLeases.map((lease) => {
      const payment = lease.rentPayments.find((p) => p.periodYear === year && p.periodMonth === month) ?? null;
      const balance = calculateLeaseBalance({
        rentPayments: lease.rentPayments,
        transactions: lease.transactions,
      });

      // Build per-charge breakdown for this period
      const activeCharges = lease.monthlyCharges
        .filter((c) => {
          if (!c.isActive) return false;
          const ps = new Date(year, month - 1, 1);
          const pe = new Date(year, month, 0, 23, 59, 59);
          if (c.startDate && new Date(c.startDate) > pe) return false;
          if (c.endDate && new Date(c.endDate) < ps) return false;
          return true;
        })
        .map((c) => ({ name: c.name, category: c.category, amount: Number(c.amount) }));

      // Compute the actual due date and late fee trigger date for this lease+period
      const lastDay = new Date(year, month, 0).getDate();
      const dueDay = Math.min(lease.paymentDueDay ?? 1, lastDay);
      const dueDateForPeriod = new Date(year, month - 1, dueDay);
      const graceDays = lease.lateFeGraceDays ?? 5;
      const lateFeeTriggerDate =
        lease.lateFeeAmount && Number(lease.lateFeeAmount) > 0
          ? new Date(dueDateForPeriod.getTime() + graceDays * 86_400_000)
          : null;

      return {
        leaseId: lease.id,
        unit: lease.unit,
        tenants: lease.tenants.map((lt) => lt.tenant),
        rentAmount: lease.rentAmount,
        monthlyDue: leaseMonthlyDueForPeriod(lease.rentAmount, lease.monthlyCharges, year, month),
        chargeBreakdown: activeCharges,
        lateFeeAmount: lease.lateFeeAmount ? Number(lease.lateFeeAmount) : null,
        lateFeGraceDays: graceDays,
        lateFeeTriggerDate: lateFeeTriggerDate?.toISOString() ?? null,
        dueDateForPeriod: dueDateForPeriod.toISOString(),
        payment,
        status: payment?.status ?? "not_generated",
        balance,
      };
    });

    return Response.json({ year, month, items: result });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
