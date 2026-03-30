import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";
import { formatCurrency } from "@/lib/utils";

type ToolInput = Record<string, unknown>;

export async function handleTool(name: string, input: ToolInput, organizationId: string): Promise<string> {
  switch (name) {
    case "get_properties": {
      const props = await prisma.property.findMany({
        where: {
          organizationId,
          archivedAt: null,
          ...(input.status ? { status: input.status as string } : {}),
          ...(input.search ? { OR: [{ name: { contains: input.search as string, mode: "insensitive" } }, { addressLine1: { contains: input.search as string, mode: "insensitive" } }] } : {}),
        },
        include: { _count: { select: { units: true } } },
      });
      if (!props.length) return "No properties found.";
      return props.map((p) => `• ${p.name} (${p.addressLine1}, ${p.city}) — Status: ${p.status}, Units: ${p._count.units}`).join("\n");
    }

    case "get_tenants": {
      const tenants = await prisma.tenant.findMany({
        where: {
          organizationId,
          ...(input.search ? {
            OR: [
              { firstName: { contains: input.search as string, mode: "insensitive" } },
              { lastName: { contains: input.search as string, mode: "insensitive" } },
              { email: { contains: input.search as string, mode: "insensitive" } },
            ],
          } : {}),
        },
        include: {
          leaseLinks: {
            where: { lease: { status: "active" } },
            include: { lease: { include: { unit: { include: { property: true } } } } },
          },
        },
        take: 20,
      });
      if (!tenants.length) return "No tenants found.";
      return tenants.map((t) => {
        const lease = t.leaseLinks[0]?.lease;
        const location = lease ? `${lease.unit.property.name} unit ${lease.unit.unitNumber}` : "No active lease";
        return `• ${t.firstName} ${t.lastName} (${t.email ?? "no email"}) — ${location}`;
      }).join("\n");
    }

    case "get_tenant_balance": {
      const name = input.tenantName as string;
      const [firstName, ...lastParts] = name.split(" ");
      const lastName = lastParts.join(" ");

      const tenant = await prisma.tenant.findFirst({
        where: {
          organizationId,
          OR: [
            { firstName: { contains: name, mode: "insensitive" } },
            { lastName: { contains: name, mode: "insensitive" } },
            { AND: [{ firstName: { contains: firstName, mode: "insensitive" } }, { lastName: { contains: lastName, mode: "insensitive" } }] },
          ],
        },
        include: {
          leaseLinks: {
            include: {
              lease: {
                include: {
                  rentPayments: { orderBy: { dueDate: "desc" }, take: 6 },
                },
              },
            },
          },
        },
      });

      if (!tenant) return `No tenant found matching "${name}".`;

      const lease = tenant.leaseLinks[0]?.lease;
      if (!lease) return `${tenant.firstName} ${tenant.lastName} has no active lease.`;

      const payments = lease.rentPayments;
      const overdue = payments.filter((p) => p.status === "overdue");
      const totalOverdue = overdue.reduce((s, p) => s + (Number(p.amountDue) - Number(p.amountPaid)), 0);

      const lines = [
        `**${tenant.firstName} ${tenant.lastName}**`,
        `Monthly rent: ${formatCurrency(Number(lease.rentAmount))}`,
        `Total overdue balance: ${formatCurrency(totalOverdue)}`,
        `Recent payments:`,
        ...payments.map((p) => `  ${p.periodYear}-${String(p.periodMonth).padStart(2, "0")}: ${p.status} (paid ${formatCurrency(Number(p.amountPaid))} of ${formatCurrency(Number(p.amountDue))})`),
      ];
      return lines.join("\n");
    }

    case "get_overdue_payments": {
      const payments = await prisma.rentPayment.findMany({
        where: { organizationId, status: "overdue" },
        include: { lease: { include: { tenants: { include: { tenant: true } }, unit: { include: { property: true } } } } },
        orderBy: { amountDue: "desc" },
      });
      if (!payments.length) return "No overdue payments. All tenants are current!";
      return payments.map((p) => {
        const tenant = p.lease.tenants[0]?.tenant;
        const owed = Number(p.amountDue) - Number(p.amountPaid);
        return `• ${tenant?.firstName} ${tenant?.lastName} — ${p.lease.unit.property.name} unit ${p.lease.unit.unitNumber} — Owes ${formatCurrency(owed)} (${p.periodYear}-${String(p.periodMonth).padStart(2, "0")})`;
      }).join("\n");
    }

    case "get_expiring_leases": {
      const days = (input.days as number) ?? 60;
      const leases = await prisma.lease.findMany({
        where: {
          organizationId,
          status: "active",
          endDate: { gte: new Date(), lte: addDays(new Date(), days) },
        },
        include: {
          tenants: { include: { tenant: true } },
          unit: { include: { property: true } },
        },
        orderBy: { endDate: "asc" },
      });
      if (!leases.length) return `No leases expiring in the next ${days} days.`;
      return leases.map((l) => {
        const tenant = l.tenants[0]?.tenant;
        const daysLeft = Math.ceil((new Date(l.endDate!).getTime() - Date.now()) / 86400000);
        return `• ${tenant?.firstName} ${tenant?.lastName} — ${l.unit.property.name} unit ${l.unit.unitNumber} — Expires in ${daysLeft} days (${l.endDate?.toDateString()})`;
      }).join("\n");
    }

    case "get_open_maintenance": {
      const requests = await prisma.maintenanceRequest.findMany({
        where: {
          organizationId,
          status: { in: ["open", "in_progress"] },
          ...(input.priority ? { priority: input.priority as string } : {}),
        },
        include: { property: true, unit: true },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: 20,
      });
      if (!requests.length) return "No open maintenance requests.";
      return requests.map((r) => `• [${r.priority.toUpperCase()}] ${r.title} — ${r.property.name}${r.unit ? ` unit ${r.unit.unitNumber}` : ""} (${r.status})`).join("\n");
    }

    case "get_financial_summary": {
      const now = new Date();
      const year = (input.year as number) ?? now.getFullYear();
      const month = (input.month as number) ?? now.getMonth() + 1;
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);

      const transactions = await prisma.transaction.groupBy({
        by: ["type"],
        where: { organizationId, date: { gte: start, lte: end } },
        _sum: { amount: true },
      });

      const income = transactions.find((t) => t.type === "income")?._sum.amount ?? 0;
      const expenses = transactions.find((t) => t.type === "expense")?._sum.amount ?? 0;
      const net = Number(income) - Number(expenses);

      return `**${year}-${String(month).padStart(2, "0")} Financial Summary**\nIncome: ${formatCurrency(Number(income))}\nExpenses: ${formatCurrency(Number(expenses))}\nNet: ${formatCurrency(net)}`;
    }

    case "record_payment": {
      // Return as a pending action — frontend handles confirmation
      return JSON.stringify({
        __pendingAction: true,
        type: "record_payment",
        payload: input,
        message: `Ready to record payment of ${formatCurrency(input.amount as number)} from ${input.tenantName}. Please confirm.`,
      });
    }

    default:
      return `Unknown tool: ${name}`;
  }
}
