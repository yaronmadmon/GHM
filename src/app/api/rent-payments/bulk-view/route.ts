import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

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
        rentPayments: { where: { periodYear: year, periodMonth: month } },
      },
      orderBy: [{ unit: { property: { name: "asc" } } }, { unit: { unitNumber: "asc" } }],
    });

    const result = activeLeases.map((lease) => {
      const payment = lease.rentPayments[0] ?? null;
      return {
        leaseId: lease.id,
        unit: lease.unit,
        tenants: lease.tenants.map((lt) => lt.tenant),
        rentAmount: lease.rentAmount,
        payment,
        status: payment?.status ?? "not_generated",
      };
    });

    return Response.json({ year, month, items: result });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
