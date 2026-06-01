import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { calculateLeaseOutstandingBalance } from "@/lib/rent-ledger";
import { leaseMonthlyDueForPeriod } from "@/lib/monthly-charges";
import { applicationRequirements, validateApplicationStatusTransition, type ApplicationStatus } from "@/lib/application-workflow";

type ToolInput = Record<string, unknown>;

function money(value: unknown) {
  return Number(value ?? 0);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function periodKey(date: Date) {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

async function buildAssistantFinancialSnapshot(organizationId: string) {
  const now = new Date();
  const currentPeriod = periodKey(now);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const trailingStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [properties, activeLeases, transactions, openMaintenance] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId, archivedAt: null },
      include: {
        expenses: true,
        units: {
          include: {
            leases: {
              orderBy: { startDate: "desc" },
              include: { tenants: { include: { tenant: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.lease.findMany({
      where: { organizationId, status: "active" },
      include: {
        rentPayments: true,
        transactions: true,
        unit: { include: { property: true } },
        tenants: { include: { tenant: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      },
    }),
    prisma.transaction.findMany({
      where: { organizationId, date: { gte: trailingStart } },
      include: { property: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.maintenanceRequest.findMany({
      where: { organizationId, status: { in: ["open", "in_progress", "pending_parts"] } },
      include: { property: true, unit: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 15,
    }),
  ]);

  const allUnits = properties.flatMap((property) =>
    property.units.map((unit) => {
      const activeLease = unit.leases.find((lease) => lease.status === "active");
      const lastLease = unit.leases.find((lease) => lease.status !== "active");
      return { property, unit, activeLease, lastLease };
    }),
  );

  const occupiedUnits = allUnits.filter((row) => row.activeLease);
  const vacantUnits = allUnits.filter((row) => !row.activeLease);
  const activeRents = occupiedUnits.map((row) => money(row.activeLease?.rentAmount)).filter((rent) => rent > 0);
  const portfolioMedianRent = median(activeRents);

  const vacancies = vacantUnits.map((row) => {
    const samePropertyRents = occupiedUnits
      .filter((occupied) => occupied.property.id === row.property.id)
      .map((occupied) => money(occupied.activeLease?.rentAmount))
      .filter((rent) => rent > 0);
    const projectedRent = median(samePropertyRents) || money(row.lastLease?.rentAmount) || portfolioMedianRent;
    return {
      propertyId: row.property.id,
      unitId: row.unit.id,
      propertyName: row.property.name,
      unitNumber: row.unit.unitNumber,
      projectedRent: Math.round(projectedRent),
      source: samePropertyRents.length ? "median active rent in same property" : row.lastLease ? "prior lease rent" : "portfolio median active rent",
    };
  }).sort((a, b) => b.projectedRent - a.projectedRent);

  const rentRoll = activeLeases.reduce((sum, lease) => sum + money(lease.rentAmount), 0);
  const potentialRentRoll = rentRoll + vacancies.reduce((sum, vacancy) => sum + vacancy.projectedRent, 0);

  const rentCollectedMonth = activeLeases.flatMap((lease) => lease.rentPayments)
    .filter((payment) => payment.periodYear === currentPeriod.year && payment.periodMonth === currentPeriod.month)
    .reduce((sum, payment) => sum + Math.max(0, money(payment.amountPaid)), 0);
  const rentCollectedTrailing12 = activeLeases.flatMap((lease) => lease.rentPayments)
    .filter((payment) => {
      const date = new Date(payment.periodYear, payment.periodMonth - 1, 1);
      return date >= trailingStart && date <= now;
    })
    .reduce((sum, payment) => sum + Math.max(0, money(payment.amountPaid)), 0);

  const isNonRentIncome = (transaction: { type: string; category: string }) =>
    transaction.type === "income" && transaction.category !== "rent";
  const otherIncomeMonth = transactions
    .filter((transaction) => isNonRentIncome(transaction) && transaction.date >= startOfMonth)
    .reduce((sum, transaction) => sum + money(transaction.amount), 0);
  const otherIncomeTrailing12 = transactions
    .filter(isNonRentIncome)
    .reduce((sum, transaction) => sum + money(transaction.amount), 0);
  const expensesMonth = transactions
    .filter((transaction) => transaction.type === "expense" && transaction.date >= startOfMonth)
    .reduce((sum, transaction) => sum + money(transaction.amount), 0);
  const expensesTrailing12 = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + money(transaction.amount), 0);

  const outstandingTenants = activeLeases.map((lease) => {
    const tenant = lease.tenants[0]?.tenant;
    const balance = calculateLeaseOutstandingBalance({
      rentPayments: lease.rentPayments,
      transactions: lease.transactions,
    });
    return {
      tenantId: tenant?.id ?? null,
      leaseId: lease.id,
      tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : "Unknown tenant",
      propertyName: lease.unit.property.name,
      unitNumber: lease.unit.unitNumber,
      balance: Math.round(balance * 100) / 100,
    };
  }).filter((row) => row.balance > 0).sort((a, b) => b.balance - a.balance);

  const knownMonthlyPropertyExpenses = properties.reduce((sum, property) => {
    const exp = property.expenses;
    if (!exp) return sum;
    return sum + [
      exp.propertyTaxMonthly,
      exp.waterSewerMonthly,
      exp.electricityMonthly,
      exp.gasMonthly,
      exp.insuranceMonthly,
      exp.mortgageMonthly,
      exp.hoaMonthly,
      exp.otherMonthly,
    ].reduce((inner, value) => inner + money(value), 0);
  }, 0);

  const expensesByCategory = Object.values(transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce<Record<string, { category: string; amount: number }>>((acc, transaction) => {
      acc[transaction.category] ??= { category: transaction.category, amount: 0 };
      acc[transaction.category].amount += money(transaction.amount);
      return acc;
    }, {}))
    .sort((a, b) => b.amount - a.amount);

  const missingExpenseProperties = properties
    .filter((property) => !property.expenses)
    .map((property) => property.name);

  return {
    asOf: now.toISOString(),
    units: {
      total: allUnits.length,
      occupied: occupiedUnits.length,
      vacant: vacancies.length,
      occupancyRate: allUnits.length ? Math.round((occupiedUnits.length / allUnits.length) * 100) : 0,
    },
    rent: {
      currentMonthlyRentRoll: Math.round(rentRoll),
      potentialMonthlyRentRoll: Math.round(potentialRentRoll),
      vacancyLossMonthly: Math.round(potentialRentRoll - rentRoll),
      vacancyLossAnnual: Math.round((potentialRentRoll - rentRoll) * 12),
      rentCollectedThisMonth: Math.round(rentCollectedMonth),
      rentCollectedTrailing12: Math.round(rentCollectedTrailing12),
      otherIncomeThisMonth: Math.round(otherIncomeMonth),
      otherIncomeTrailing12: Math.round(otherIncomeTrailing12),
    },
    expenses: {
      recordedThisMonth: Math.round(expensesMonth),
      recordedTrailing12: Math.round(expensesTrailing12),
      knownMonthlyPropertyExpenses: Math.round(knownMonthlyPropertyExpenses),
      topCategories: expensesByCategory.slice(0, 6).map((row) => ({ category: row.category, amount: Math.round(row.amount) })),
      missingExpenseProperties,
    },
    cashFlow: {
      currentMonthNetFromRecordedActivity: Math.round(rentCollectedMonth + otherIncomeMonth - expensesMonth),
      trailing12NetFromRecordedActivity: Math.round(rentCollectedTrailing12 + otherIncomeTrailing12 - expensesTrailing12),
    },
    collections: {
      outstandingBalance: Math.round(outstandingTenants.reduce((sum, row) => sum + row.balance, 0) * 100) / 100,
      tenantCount: outstandingTenants.length,
      tenants: outstandingTenants.slice(0, 15),
    },
    vacancies: vacancies.slice(0, 15),
    maintenance: {
      openCount: openMaintenance.length,
      items: openMaintenance.slice(0, 8).map((item) => ({
        id: item.id,
        propertyName: item.property.name,
        unitNumber: item.unit?.unitNumber ?? null,
        title: item.title,
        priority: item.priority,
        status: item.status,
        estimatedCost: money(item.estimatedCost),
      })),
    },
    dataSources: [
      "Lease.rentAmount for current rent roll",
      "RentPayment.amountPaid for collected rent",
      "Transaction records for non-rent income and expenses",
      "PropertyExpenses only where user-entered recurring expenses exist",
      "Shared rent-ledger helper for outstanding balances",
    ],
    warnings: [
      ...(missingExpenseProperties.length ? [`${missingExpenseProperties.length} properties have no recurring expense profile.`] : []),
      ...(transactions.length === 0 ? ["No trailing-12 transaction records were found, so expense and cash-flow analysis is incomplete."] : []),
    ],
  };
}

export async function handleTool(
  name: string,
  input: ToolInput,
  organizationId: string,
  userId: string,
): Promise<string> {
  switch (name) {

    // ── READ: properties ────────────────────────────────────────────────────
    case "get_properties": {
      const props = await prisma.property.findMany({
        where: {
          organizationId,
          archivedAt: null,
          ...(input.status ? { status: input.status as string } : {}),
          ...(input.search ? { OR: [{ name: { contains: input.search as string, mode: "insensitive" } }, { addressLine1: { contains: input.search as string, mode: "insensitive" } }] } : {}),
        },
        include: { units: { select: { id: true, unitNumber: true, status: true } }, _count: { select: { units: true } } },
      });
      if (!props.length) return "No properties found.";
      return props.map((p) =>
        `• [${p.id}] ${p.name} (${p.addressLine1}, ${p.city}) — Status: ${p.status}, Units: ${p._count.units}\n  Units: ${p.units.map((u) => `[${u.id}] ${u.unitNumber} (${u.status})`).join(", ") || "none"}`
      ).join("\n");
    }

    // ── READ: tenants ────────────────────────────────────────────────────────
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
        return `• [${t.id}] ${t.firstName} ${t.lastName} (${t.email ?? "no email"}) — ${location}`;
      }).join("\n");
    }

    // ── READ: tenant balance ─────────────────────────────────────────────────
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
                  rentPayments: { orderBy: { dueDate: "desc" } },
                  transactions: { orderBy: { date: "desc" } },
                  unit: { include: { property: true } },
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
      const outstandingBalance = calculateLeaseOutstandingBalance({
        rentPayments: lease.rentPayments,
        transactions: lease.transactions,
      });
      return [
        `**${tenant.firstName} ${tenant.lastName}**`,
        `Location: ${lease.unit.property.name} unit ${lease.unit.unitNumber}`,
        `Monthly rent: ${formatCurrency(Number(lease.rentAmount))}`,
        `Outstanding balance: ${formatCurrency(outstandingBalance)}`,
        `Balance source: shared rent-ledger calculation, including imported ledger running balances when available.`,
        `Recent payments:`,
        ...payments.slice(0, 6).map((p) => `  ${p.periodYear}-${String(p.periodMonth).padStart(2, "0")}: ${p.status} (paid ${formatCurrency(Number(p.amountPaid))} of ${formatCurrency(Number(p.amountDue))})`),
      ].join("\n");
    }

    // ── READ: overdue payments ───────────────────────────────────────────────
    case "get_overdue_payments": {
      const leases = await prisma.lease.findMany({
        where: { organizationId, status: "active" },
        include: {
          rentPayments: true,
          transactions: true,
          tenants: { include: { tenant: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
          unit: { include: { property: true } },
        },
      });
      const overdue = leases.map((lease) => {
        const tenant = lease.tenants[0]?.tenant;
        const balance = calculateLeaseOutstandingBalance({ rentPayments: lease.rentPayments, transactions: lease.transactions });
        return { lease, tenant, balance };
      }).filter((row) => row.tenant && row.balance > 0).sort((a, b) => b.balance - a.balance);
      if (!overdue.length) return "No tenant balances due. All visible active leases are current.";
      const total = overdue.reduce((sum, row) => sum + row.balance, 0);
      return [
        `Total outstanding balance: ${formatCurrency(total)} across ${overdue.length} tenant${overdue.length === 1 ? "" : "s"}.`,
        ...overdue.map((row) => {
          const tenant = row.tenant;
          return `- [${tenant?.id}] ${tenant?.firstName} ${tenant?.lastName} - ${row.lease.unit.property.name} unit ${row.lease.unit.unitNumber} - Owes ${formatCurrency(row.balance)}`;
        }),
        `Source: shared rent-ledger calculation, not only RentPayment.status.`,
      ].join("\n");
    }

    case "get_portfolio_financial_snapshot": {
      return JSON.stringify(await buildAssistantFinancialSnapshot(organizationId), null, 2);
    }

    case "calculate_income_scenario": {
      const snapshot = await buildAssistantFinancialSnapshot(organizationId);
      const fillCount = input.includeAllVacancies
        ? snapshot.vacancies.length
        : Math.max(0, Math.min(snapshot.vacancies.length, Math.floor(Number(input.fillVacancies ?? 0))));
      const filledVacancies = snapshot.vacancies.slice(0, fillCount);
      const vacancyMonthlyUpside = filledVacancies.reduce((sum, vacancy) => sum + vacancy.projectedRent, 0);
      const additionalMonthlyRent = Math.max(0, Number(input.additionalMonthlyRent ?? 0));
      const monthlyExpenseReduction = Math.max(0, Number(input.monthlyExpenseReduction ?? 0));
      const collectionTarget = input.collectAllOutstanding
        ? snapshot.collections.outstandingBalance
        : Math.max(0, Number(input.collectionTarget ?? 0));
      const recurringUpside = vacancyMonthlyUpside + additionalMonthlyRent + monthlyExpenseReduction;
      const projectedMonthlyRentRoll = snapshot.rent.currentMonthlyRentRoll + vacancyMonthlyUpside + additionalMonthlyRent;
      const projectedMonthlyNet = snapshot.cashFlow.currentMonthNetFromRecordedActivity + recurringUpside;

      return [
        `Current monthly rent roll: ${formatCurrency(snapshot.rent.currentMonthlyRentRoll)}.`,
        `Projected monthly rent roll: ${formatCurrency(projectedMonthlyRentRoll)}.`,
        `Monthly upside: ${formatCurrency(recurringUpside)}.`,
        `Annual recurring upside: ${formatCurrency(recurringUpside * 12)}.`,
        `Current recorded monthly net: ${formatCurrency(snapshot.cashFlow.currentMonthNetFromRecordedActivity)}.`,
        `Projected recorded monthly net: ${formatCurrency(projectedMonthlyNet)}.`,
        collectionTarget > 0 ? `One-time collections opportunity included separately: ${formatCurrency(Math.min(collectionTarget, snapshot.collections.outstandingBalance))}.` : null,
        filledVacancies.length
          ? `Vacancies filled in this scenario: ${filledVacancies.map((vacancy) => `${vacancy.propertyName} unit ${vacancy.unitNumber} at about ${formatCurrency(vacancy.projectedRent)}`).join("; ")}.`
          : `No vacancy fill was included in this scenario.`,
        `Sources: current active leases, vacant units, RentPayment.amountPaid, Transaction expenses, and shared ledger balances. Projections use existing rent data only.`,
      ].filter(Boolean).join("\n");
    }

    case "__legacy_get_overdue_payments": {
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

    // ── READ: expiring leases ────────────────────────────────────────────────
    case "get_expiring_leases": {
      const days = (input.days as number) ?? 60;
      const leases = await prisma.lease.findMany({
        where: { organizationId, status: "active", endDate: { gte: new Date(), lte: addDays(new Date(), days) } },
        include: { tenants: { include: { tenant: true } }, unit: { include: { property: true } } },
        orderBy: { endDate: "asc" },
      });
      if (!leases.length) return `No leases expiring in the next ${days} days.`;
      return leases.map((l) => {
        const tenant = l.tenants[0]?.tenant;
        const daysLeft = Math.ceil((new Date(l.endDate!).getTime() - Date.now()) / 86400000);
        return `• [${l.id}] ${tenant?.firstName} ${tenant?.lastName} — ${l.unit.property.name} unit ${l.unit.unitNumber} — Expires in ${daysLeft} days`;
      }).join("\n");
    }

    // ── READ: maintenance ────────────────────────────────────────────────────
    case "get_open_maintenance": {
      const requests = await prisma.maintenanceRequest.findMany({
        where: {
          organizationId,
          status: { in: (input.status ? [input.status as string] : ["open", "in_progress", "pending_parts"]) },
          ...(input.priority ? { priority: input.priority as string } : {}),
        },
        include: { property: true, unit: true, assignedVendor: true },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: 20,
      });
      if (!requests.length) return "No open maintenance requests.";
      return requests.map((r) =>
        `• [${r.id}] [${r.priority.toUpperCase()}] ${r.title} — ${r.property.name}${r.unit ? ` unit ${r.unit.unitNumber}` : ""} (${r.status})${r.assignedVendor ? ` — Vendor: ${r.assignedVendor.name}` : ""}`
      ).join("\n");
    }

    // ── READ: financial summary ───────────────────────────────────────────────
    case "get_financial_summary": {
      const now = new Date();
      const year = (input.year as number) ?? now.getFullYear();
      const month = (input.month as number) ?? now.getMonth() + 1;
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      const snapshot = await buildAssistantFinancialSnapshot(organizationId);
      const [rentPayments, transactions] = await Promise.all([
        prisma.rentPayment.findMany({
          where: { organizationId, periodYear: year, periodMonth: month },
        }),
        prisma.transaction.findMany({
          where: { organizationId, date: { gte: start, lte: end } },
        }),
      ]);
      const rentCollected = rentPayments.reduce((sum, payment) => sum + Math.max(0, money(payment.amountPaid)), 0);
      const otherIncome = transactions
        .filter((transaction) => transaction.type === "income" && transaction.category !== "rent")
        .reduce((sum, transaction) => sum + money(transaction.amount), 0);
      const expenses = transactions
        .filter((transaction) => transaction.type === "expense")
        .reduce((sum, transaction) => sum + money(transaction.amount), 0);
      const income = rentCollected + otherIncome;
      const net = income - expenses;
      return [
        `**${year}-${String(month).padStart(2, "0")} Financial Summary**`,
        `Collected rent: ${formatCurrency(rentCollected)}`,
        `Other income: ${formatCurrency(otherIncome)}`,
        `Recorded expenses: ${formatCurrency(expenses)}`,
        `Net from recorded activity: ${formatCurrency(net)}`,
        `Current monthly rent roll: ${formatCurrency(snapshot.rent.currentMonthlyRentRoll)}`,
        `Potential rent roll if all vacancies are filled: ${formatCurrency(snapshot.rent.potentialMonthlyRentRoll)}`,
        `Outstanding tenant balances: ${formatCurrency(snapshot.collections.outstandingBalance)}`,
        `Source: RentPayment.amountPaid for collected rent, Transaction records for non-rent income and expenses, shared ledger balances for balances due.`,
      ].join("\n");
    }

    // ── READ: lease details ───────────────────────────────────────────────────
    case "get_lease_details": {
      const leaseInclude = { tenants: { include: { tenant: true } }, unit: { include: { property: true } }, documents: true } as const;
      type LeaseWithDetails = Awaited<ReturnType<typeof prisma.lease.findFirst<{ include: typeof leaseInclude }>>>;
      let lease: LeaseWithDetails = null;

      if (input.leaseId) {
        lease = await prisma.lease.findFirst({ where: { id: input.leaseId as string, organizationId }, include: leaseInclude });
      } else if (input.tenantName) {
        const name = input.tenantName as string;
        const tenant = await prisma.tenant.findFirst({
          where: { organizationId, OR: [{ firstName: { contains: name, mode: "insensitive" } }, { lastName: { contains: name, mode: "insensitive" } }] },
          include: { leaseLinks: { include: { lease: { include: leaseInclude } } } },
        });
        lease = tenant?.leaseLinks[0]?.lease ?? null;
      }

      if (!lease) return "Lease not found.";
      return [
        `**Lease [${lease.id}]**`,
        `Property: ${lease.unit.property.name} — Unit ${lease.unit.unitNumber}`,
        `Tenants: ${lease.tenants.map((lt) => `${lt.tenant.firstName} ${lt.tenant.lastName}`).join(", ")}`,
        `Rent: ${formatCurrency(Number(lease.rentAmount))}/month  Deposit: ${formatCurrency(Number(lease.depositAmount ?? 0))}`,
        `Dates: ${new Date(lease.startDate).toDateString()} → ${lease.endDate ? new Date(lease.endDate).toDateString() : "month-to-month"}`,
        `Status: ${lease.status}  Signing: ${lease.signingStatus}`,
        `Documents: ${lease.documents.length}`,
      ].join("\n");
    }

    // ── READ: vendors ─────────────────────────────────────────────────────────
    case "get_vendors": {
      const vendors = await prisma.vendor.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
      if (!vendors.length) return "No vendors on file. Use create_vendor to add one.";
      return vendors.map((v) =>
        `• [${v.id}] ${v.name}${v.trade ? ` (${v.trade})` : ""}${v.phone ? ` — ${v.phone}` : ""}${v.email ? ` — ${v.email}` : ""}`
      ).join("\n");
    }

    // ── READ: messages ────────────────────────────────────────────────────────
    case "get_messages": {
      const threads = await prisma.messageThread.findMany({
        where: { organizationId },
        include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
        orderBy: { lastMessageAt: "desc" },
        take: 10,
      });
      if (!threads.length) return "No message threads found.";
      return threads.map((t) => {
        const last = t.messages[0];
        return `• [${t.id}] "${t.subject}" — last message: ${last?.body?.slice(0, 60) ?? "none"} (${last?.senderRole ?? "?"})`;
      }).join("\n");
    }

    // ── READ: applications ────────────────────────────────────────────────────
    case "list_applications": {
      const apps = await prisma.application.findMany({
        where: { organizationId, ...(input.status ? { status: input.status as string } : {}) },
        include: { property: { select: { name: true } }, unit: { select: { unitNumber: true } }, _count: { select: { documents: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      if (!apps.length) return "No applications found.";
      return apps.map((a) => {
        const loc = a.property?.name ? `${a.property.name}${a.unit ? ` unit ${a.unit.unitNumber}` : ""}` : "unknown property";
        return `• [${a.id}] ${a.firstName} ${a.lastName} — ${loc} — Status: ${a.status} — Docs: ${a._count.documents}`;
      }).join("\n");
    }

    case "get_application": {
      const includeOpts = { property: { select: { name: true } }, unit: { select: { unitNumber: true } }, documents: true, references: true } as const;
      const app = input.applicationId
        ? await prisma.application.findFirst({ where: { id: input.applicationId as string, organizationId }, include: includeOpts })
        : input.applicantName
          ? await (async () => {
              const name = input.applicantName as string;
              const [firstName, ...lastParts] = name.split(" ");
              return prisma.application.findFirst({
                where: { organizationId, OR: [{ firstName: { contains: firstName, mode: "insensitive" } }, { lastName: { contains: lastParts.join(" "), mode: "insensitive" } }] },
                include: includeOpts, orderBy: { createdAt: "desc" },
              });
            })()
          : null;
      if (!app) return "Application not found.";
      return [
        `**Application: ${app.firstName} ${app.lastName}** (ID: ${app.id})`,
        `Status: ${app.status}`,
        `Property: ${app.property?.name ?? "N/A"}${app.unit ? ` unit ${app.unit.unitNumber}` : ""}`,
        `Email: ${app.email ?? "missing"} | Phone: ${app.phone ?? "missing"}`,
        `Employer: ${app.employerName ?? "N/A"} | Income: ${app.monthlyIncome ? formatCurrency(Number(app.monthlyIncome)) + "/mo" : "N/A"}`,
        `Screening: ${app.backgroundCheckStatus ?? "not_started"}`,
        `Documents: ${app.documents.length} | References: ${app.references.length}`,
        `Submitted: ${app.createdAt.toDateString()}`,
      ].join("\n");
    }

    // ── WRITE: create tenant ──────────────────────────────────────────────────
    case "create_tenant": {
      const tenant = await prisma.tenant.create({
        data: {
          organizationId,
          firstName: input.firstName as string,
          lastName: input.lastName as string,
          email: (input.email as string) || undefined,
          phone: (input.phone as string) || undefined,
          notes: (input.notes as string) || undefined,
        },
      });
      await prisma.activityEvent.create({
        data: { organizationId, actorId: userId, entityType: "tenant", entityId: tenant.id, eventType: "created", metadata: { name: `${tenant.firstName} ${tenant.lastName}`, actor: "ai_assistant" } },
      });
      return `Tenant created: **${tenant.firstName} ${tenant.lastName}** (ID: ${tenant.id})`;
    }

    // ── WRITE: update tenant ──────────────────────────────────────────────────
    case "update_tenant": {
      const tenantId = input.tenantId as string;
      const existing = await prisma.tenant.findFirst({ where: { id: tenantId, organizationId } });
      if (!existing) return `Tenant not found: ${tenantId}`;
      const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          ...(input.firstName ? { firstName: input.firstName as string } : {}),
          ...(input.lastName ? { lastName: input.lastName as string } : {}),
          ...(input.email !== undefined ? { email: (input.email as string) || null } : {}),
          ...(input.phone !== undefined ? { phone: (input.phone as string) || null } : {}),
          ...(input.notes !== undefined ? { notes: (input.notes as string) || null } : {}),
        },
      });
      return `Tenant updated: **${updated.firstName} ${updated.lastName}**`;
    }

    // ── WRITE: create property ────────────────────────────────────────────────
    case "delete_tenant": {
      const tenantId = input.tenantId as string;
      const existing = await prisma.tenant.findFirst({
        where: { id: tenantId, organizationId },
        include: {
          leaseLinks: { include: { lease: { include: { unit: { include: { property: true } } } } } },
        },
      });
      if (!existing) return `Tenant not found: ${tenantId}`;
      const activeLinks = existing.leaseLinks.filter((link) => link.lease.status === "active");
      if (activeLinks.length && input.force !== true) {
        return [
          `${existing.firstName} ${existing.lastName} has ${activeLinks.length} active lease link${activeLinks.length === 1 ? "" : "s"}.`,
          `I did not delete the tenant. If you really want to remove this tenant and unlink active leases, say that explicitly.`,
          ...activeLinks.map((link) => `- Lease ${link.lease.id}: ${link.lease.unit.property.name} unit ${link.lease.unit.unitNumber}`),
        ].join("\n");
      }

      await prisma.$transaction(async (tx) => {
        await tx.application.updateMany({
          where: { organizationId, convertedTenantId: tenantId },
          data: { convertedTenantId: null },
        });
        await tx.leaseTenant.deleteMany({ where: { tenantId } });
        await tx.portalSession.deleteMany({ where: { tenantId } });
        await tx.tenant.delete({ where: { id: tenantId } });
        await tx.activityEvent.create({
          data: {
            organizationId,
            actorId: userId,
            entityType: "tenant",
            entityId: tenantId,
            eventType: "deleted",
            metadata: { name: `${existing.firstName} ${existing.lastName}`, actor: "ai_assistant" },
          },
        });
      });
      return `Tenant deleted: **${existing.firstName} ${existing.lastName}**.`;
    }

    case "create_property": {
      const unitCount = Math.max(1, (input.unitCount as number) ?? 1);
      const property = await prisma.property.create({
        data: {
          organizationId,
          name: input.name as string,
          addressLine1: input.addressLine1 as string,
          city: input.city as string,
          state: input.state as string,
          zip: input.zip as string,
          propertyType: (input.propertyType as string) ?? "single_family",
          unitCount,
          status: "vacant",
        },
      });
      // Create initial units
      const unitNumbers = unitCount === 1 ? ["1"] : Array.from({ length: unitCount }, (_, i) => String(i + 1));
      await prisma.unit.createMany({
        data: unitNumbers.map((n) => ({ propertyId: property.id, unitNumber: n, status: "vacant" })),
      });
      const units = await prisma.unit.findMany({ where: { propertyId: property.id } });
      await prisma.activityEvent.create({
        data: { organizationId, actorId: userId, entityType: "property", entityId: property.id, eventType: "created", metadata: { name: property.name, actor: "ai_assistant" } },
      });
      return `Property created: **${property.name}** (ID: ${property.id})\nUnits created: ${units.map((u) => `[${u.id}] Unit ${u.unitNumber}`).join(", ")}`;
    }

    // ── WRITE: add unit ───────────────────────────────────────────────────────
    case "add_unit": {
      const property = await prisma.property.findFirst({ where: { id: input.propertyId as string, organizationId } });
      if (!property) return `Property not found: ${input.propertyId}`;
      const unit = await prisma.unit.create({
        data: {
          propertyId: input.propertyId as string,
          unitNumber: input.unitNumber as string,
          bedrooms: (input.bedrooms as number) ?? undefined,
          bathrooms: (input.bathrooms as number) ?? undefined,
          sqft: (input.sqft as number) ?? undefined,
          status: "vacant",
        },
      });
      return `Unit added to ${property.name}: **Unit ${unit.unitNumber}** (ID: ${unit.id})`;
    }

    // ── WRITE: create lease ───────────────────────────────────────────────────
    case "create_lease": {
      const unit = await prisma.unit.findFirst({ where: { id: input.unitId as string, property: { organizationId } } });
      if (!unit) return `Unit not found: ${input.unitId}`;
      const tenant = await prisma.tenant.findFirst({ where: { id: input.tenantId as string, organizationId } });
      if (!tenant) return `Tenant not found: ${input.tenantId}`;

      const lease = await prisma.lease.create({
        data: {
          organizationId,
          unitId: input.unitId as string,
          startDate: new Date(input.startDate as string),
          endDate: input.endDate ? new Date(input.endDate as string) : undefined,
          rentAmount: input.rentAmount as number,
          depositAmount: (input.depositAmount as number) ?? undefined,
          paymentDueDay: (input.paymentDueDay as number) ?? 1,
          status: "active",
          tenants: { create: [{ tenantId: input.tenantId as string, isPrimary: true }] },
        },
        include: { unit: { include: { property: true } } },
      });
      await prisma.unit.update({ where: { id: input.unitId as string }, data: { status: "occupied" } });
      await prisma.activityEvent.create({
        data: { organizationId, actorId: userId, entityType: "lease", entityId: lease.id, eventType: "created", metadata: { tenant: `${tenant.firstName} ${tenant.lastName}`, unit: unit.unitNumber, actor: "ai_assistant" } },
      });
      return `Lease created for **${tenant.firstName} ${tenant.lastName}** at ${lease.unit.property.name} Unit ${unit.unitNumber} (Lease ID: ${lease.id})\nRent: ${formatCurrency(Number(lease.rentAmount))}/month starting ${new Date(lease.startDate).toDateString()}`;
    }

    // ── WRITE: create maintenance ─────────────────────────────────────────────
    case "create_maintenance_request": {
      const property = await prisma.property.findFirst({ where: { id: input.propertyId as string, organizationId } });
      if (!property) return `Property not found: ${input.propertyId}`;
      const request = await prisma.maintenanceRequest.create({
        data: {
          organizationId,
          propertyId: input.propertyId as string,
          title: input.title as string,
          description: input.description as string,
          priority: (input.priority as string) ?? "medium",
          category: (input.category as string) || undefined,
          assignedVendorId: (input.assignedVendorId as string) || undefined,
          status: "open",
        },
      });
      await prisma.activityEvent.create({
        data: { organizationId, actorId: userId, entityType: "maintenance", entityId: request.id, eventType: "created", metadata: { title: request.title, property: property.name, actor: "ai_assistant" } },
      });
      return `Maintenance request created: **${request.title}** at ${property.name} (ID: ${request.id})\nPriority: ${request.priority} | Status: open`;
    }

    // ── WRITE: update maintenance ─────────────────────────────────────────────
    case "update_maintenance_request": {
      const requestId = input.requestId as string;
      const existing = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, organizationId }, include: { property: true } });
      if (!existing) return `Maintenance request not found: ${requestId}`;
      const updated = await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          ...(input.status ? { status: input.status as string, ...(input.status === "completed" ? { resolvedAt: new Date() } : {}) } : {}),
          ...(input.priority ? { priority: input.priority as string } : {}),
          ...(input.assignedVendorId !== undefined ? { assignedVendorId: (input.assignedVendorId as string) || null } : {}),
        },
      });
      return `Maintenance request updated: **${existing.title}** at ${existing.property.name}\nStatus: ${updated.status} | Priority: ${updated.priority}`;
    }

    // ── WRITE: record payment (confirmation required) ─────────────────────────
    case "__legacy_record_payment": {
      return JSON.stringify({
        __pendingAction: true,
        type: "record_payment",
        payload: input,
        message: `Ready to record payment of ${formatCurrency(input.amount as number)} from ${input.tenantName}. Please confirm.`,
      });
    }

    case "record_payment": {
      const tenantName = input.tenantName as string;
      const [firstName, ...lastParts] = tenantName.split(" ");
      const lastName = lastParts.join(" ");
      const tenant = await prisma.tenant.findFirst({
        where: {
          organizationId,
          OR: [
            { firstName: { contains: tenantName, mode: "insensitive" } },
            { lastName: { contains: tenantName, mode: "insensitive" } },
            { AND: [{ firstName: { contains: firstName, mode: "insensitive" } }, { lastName: { contains: lastName, mode: "insensitive" } }] },
          ],
        },
        include: {
          leaseLinks: {
            where: { lease: { status: "active" } },
            include: { lease: { include: { unit: { include: { property: true } }, monthlyCharges: true } } },
          },
        },
      });
      if (!tenant) return `No tenant found matching "${tenantName}".`;
      const lease = tenant.leaseLinks[0]?.lease;
      if (!lease) return `${tenant.firstName} ${tenant.lastName} has no active lease, so I could not record rent.`;

      const now = new Date();
      const periodYear = Number(input.periodYear ?? now.getFullYear());
      const periodMonth = Number(input.periodMonth ?? now.getMonth() + 1);
      const dueDate = new Date(periodYear, periodMonth - 1, lease.paymentDueDay);
      const amountPaid = Number(input.amount ?? 0);
      if (amountPaid <= 0) return "Payment amount must be greater than zero.";

      const existingPayment = await prisma.rentPayment.findUnique({
        where: { leaseId_periodYear_periodMonth: { leaseId: lease.id, periodYear, periodMonth } },
      });
      const amountDue = money(existingPayment?.amountDue ?? leaseMonthlyDueForPeriod(lease.rentAmount, lease.monthlyCharges, periodYear, periodMonth));
      const newPaidTotal = money(existingPayment?.amountPaid) + amountPaid;
      let status = "pending";
      if (newPaidTotal >= amountDue) status = "paid";
      else if (newPaidTotal > 0) status = "partial";
      else if (dueDate < new Date()) status = "overdue";

      const payment = await prisma.$transaction(async (tx) => {
        const saved = await tx.rentPayment.upsert({
          where: { leaseId_periodYear_periodMonth: { leaseId: lease.id, periodYear, periodMonth } },
          update: {
            amountPaid: newPaidTotal,
            status,
            paidAt: new Date(),
            paymentMethod: (input.method as string) || undefined,
            notes: (input.notes as string) || undefined,
            recordedById: userId,
          },
          create: {
            organizationId,
            leaseId: lease.id,
            periodYear,
            periodMonth,
            amountDue,
            amountPaid,
            status,
            dueDate,
            paidAt: new Date(),
            paymentMethod: (input.method as string) || undefined,
            notes: (input.notes as string) || undefined,
            recordedById: userId,
          },
        });
        await tx.transaction.create({
          data: {
            organizationId,
            leaseId: lease.id,
            propertyId: lease.unit.property.id,
            unitId: lease.unit.id,
            type: "income",
            category: "rent",
            amount: amountPaid,
            date: new Date(),
            description: `Rent payment ${periodYear}-${String(periodMonth).padStart(2, "0")} - ${tenant.firstName} ${tenant.lastName}`,
            paymentMethod: (input.method as string) || undefined,
            referenceId: saved.id,
            createdById: userId,
          },
        });
        await tx.activityEvent.create({
          data: {
            organizationId,
            actorId: userId,
            entityType: "payment",
            entityId: saved.id,
            eventType: "payment_recorded",
            metadata: { amount: amountPaid, status, period: `${periodYear}-${periodMonth}`, actor: "ai_assistant" },
          },
        });
        return saved;
      });

      return `Recorded ${formatCurrency(amountPaid)} rent payment from **${tenant.firstName} ${tenant.lastName}** for ${periodYear}-${String(periodMonth).padStart(2, "0")}. Total paid for that period is now ${formatCurrency(Number(payment.amountPaid))}; status is ${payment.status}.`;
    }

    // ── WRITE: send message ───────────────────────────────────────────────────
    case "send_message": {
      const tenant = await prisma.tenant.findFirst({ where: { id: input.tenantId as string, organizationId } });
      if (!tenant) return `Tenant not found: ${input.tenantId}`;

      const tenantUserId = tenant.portalUserId ?? tenant.id;
      const subject = (input.subject as string) || `Message from your landlord`;
      const body = input.body as string;

      // Find existing thread with this tenant
      const existingThread = await prisma.messageThread.findFirst({
        where: { organizationId, landlordUserId: userId, tenantUserId },
      });

      if (existingThread) {
        await prisma.$transaction([
          prisma.message.create({
            data: { organizationId, threadId: existingThread.id, senderId: userId, senderRole: "landlord", recipientId: tenantUserId, body },
          }),
          prisma.messageThread.update({ where: { id: existingThread.id }, data: { lastMessageAt: new Date() } }),
        ]);
        return `Message sent to **${tenant.firstName} ${tenant.lastName}** in existing thread "${existingThread.subject}"`;
      } else {
        const thread = await prisma.$transaction(async (tx) => {
          const t = await tx.messageThread.create({
            data: { organizationId, subject, landlordUserId: userId, tenantUserId, lastMessageAt: new Date() },
          });
          await tx.message.create({
            data: { organizationId, threadId: t.id, senderId: userId, senderRole: "landlord", recipientId: tenantUserId, body },
          });
          return t;
        });
        return `New message thread created with **${tenant.firstName} ${tenant.lastName}**: "${subject}"`;
      }
    }

    // ── WRITE: create transaction ─────────────────────────────────────────────
    case "create_transaction": {
      const date = input.date ? new Date(input.date as string) : new Date();
      const transaction = await prisma.transaction.create({
        data: {
          organizationId,
          type: input.type as string,
          category: input.category as string,
          amount: input.amount as number,
          date,
          description: (input.description as string) || undefined,
          propertyId: (input.propertyId as string) || undefined,
          createdById: userId,
        },
      });
      return `Transaction recorded: ${input.type === "income" ? "+" : "-"}${formatCurrency(Number(transaction.amount))} (${transaction.category}) on ${date.toDateString()}`;
    }

    // ── WRITE: create vendor ──────────────────────────────────────────────────
    case "create_vendor": {
      const vendor = await prisma.vendor.create({
        data: {
          organizationId,
          name: input.name as string,
          trade: (input.trade as string) || undefined,
          phone: (input.phone as string) || undefined,
          email: (input.email as string) || undefined,
          notes: (input.notes as string) || undefined,
        },
      });
      return `Vendor added: **${vendor.name}**${vendor.trade ? ` (${vendor.trade})` : ""} (ID: ${vendor.id})`;
    }

    // ── WRITE: application workflow ───────────────────────────────────────────
    case "advance_application_status": {
      const appId = input.applicationId as string;
      const newStatus = input.status as string;
      const app = await prisma.application.findFirst({ where: { id: appId, organizationId }, include: { documents: true } });
      if (!app) return "Application not found.";
      const validation = validateApplicationStatusTransition(app, newStatus as ApplicationStatus);
      if (!validation.ok) return `Cannot update application status: ${validation.blockers.join(" ")}`;
      await prisma.application.update({ where: { id: appId }, data: { status: newStatus } });
      await prisma.activityEvent.create({
        data: { organizationId, actorId: userId, entityType: "application", entityId: appId, eventType: "status_changed", metadata: { from: app.status, to: newStatus, actor: "ai_assistant" } },
      });
      return `Application status updated from "${app.status}" to "${newStatus}".`;
    }

    case "set_screening_status": {
      const appId = input.applicationId as string;
      const app = await prisma.application.findFirst({ where: { id: appId, organizationId } });
      if (!app) return "Application not found.";
      await prisma.application.update({
        where: { id: appId },
        data: {
          backgroundCheckStatus: input.backgroundCheckStatus as string,
          backgroundCheckNotes: (input.backgroundCheckNotes as string) ?? undefined,
          backgroundCheckDate: input.backgroundCheckDate ? new Date(input.backgroundCheckDate as string) : undefined,
        },
      });
      await prisma.activityEvent.create({
        data: { organizationId, actorId: userId, entityType: "application", entityId: appId, eventType: "updated", metadata: { field: "backgroundCheckStatus", from: app.backgroundCheckStatus, to: String(input.backgroundCheckStatus), actor: "ai_assistant" } },
      });
      return `Screening status set to "${input.backgroundCheckStatus}" for ${app.firstName} ${app.lastName}.`;
    }

    case "add_application_document": {
      const appId = input.applicationId as string;
      const app = await prisma.application.findFirst({ where: { id: appId, organizationId } });
      if (!app) return "Application not found.";
      await prisma.applicationDocument.create({
        data: { applicationId: appId, name: input.name as string, url: input.url as string, docType: input.docType as string },
      });
      await prisma.activityEvent.create({
        data: { organizationId, actorId: userId, entityType: "application", entityId: appId, eventType: "updated", metadata: { action: "document_added", docType: String(input.docType), name: String(input.name), actor: "ai_assistant" } },
      });
      return `Document "${input.name}" (${input.docType}) added to ${app.firstName} ${app.lastName}'s application.`;
    }

    case "approve_application_and_create_lease": {
      const appId = input.applicationId as string;
      const application = await prisma.application.findFirst({
        where: { id: appId, organizationId },
        include: { documents: true },
      });
      if (!application) return "Application not found.";
      if (application.status === "approved") return "Application is already approved.";
      if (application.status !== "screening") return "Application must be in screening before approval.";
      if (!application.unitId) return "Cannot approve: no unit is associated with this application.";
      const guards = applicationRequirements(application).blockers;
      if (guards.length) return `Cannot approve: ${guards.join(" ")}`;

      const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            organizationId,
            firstName: application.firstName,
            lastName: application.lastName,
            email: application.email,
            phone: application.phone ?? undefined,
            dateOfBirth: application.dateOfBirth ?? undefined,
          },
        });
        const lease = await tx.lease.create({
          data: {
            organizationId,
            unitId: application.unitId!,
            startDate: new Date(input.startDate as string),
            endDate: input.endDate ? new Date(input.endDate as string) : undefined,
            rentAmount: input.rentAmount as number,
            depositAmount: (input.depositAmount as number) ?? undefined,
            status: "active",
            tenants: { create: { tenantId: tenant.id, isPrimary: true } },
          },
        });
        await tx.unit.update({ where: { id: application.unitId! }, data: { status: "occupied" } });
        await tx.application.update({
          where: { id: appId },
          data: {
            status: "approved",
            convertedTenantId: tenant.id,
            convertedLeaseId: lease.id,
            reviewedById: userId,
            reviewedAt: new Date(),
          },
        });
        await tx.activityEvent.create({
          data: { organizationId, actorId: userId, entityType: "application", entityId: appId, eventType: "status_changed", metadata: { from: application.status, to: "approved", tenantId: tenant.id, leaseId: lease.id, actor: "ai_assistant" } },
        });
        return { tenant, lease };
      });

      return `Approved ${application.firstName} ${application.lastName}. Tenant ID: ${result.tenant.id}. Lease ID: ${result.lease.id}.`;
    }

    case "confirm_move_in": {
      const leaseId = input.leaseId as string;
      const lease = await prisma.lease.findFirst({
        where: { id: leaseId, organizationId },
        include: { tenants: { include: { tenant: true } }, convertedFrom: { select: { id: true } } },
      });
      if (!lease) return "Lease not found.";
      if (lease.signingStatus !== "fully_signed") return `Cannot confirm move-in: lease signing status is "${lease.signingStatus}" (must be fully_signed).`;
      if (lease.moveInCompleted) return "Move-in already confirmed for this lease.";
      await prisma.lease.update({ where: { id: leaseId }, data: { moveInCompleted: true, moveInCompletedAt: new Date() } });
      await prisma.activityEvent.create({
        data: { organizationId, actorId: userId, entityType: "lease", entityId: leaseId, eventType: "status_changed", metadata: { action: "move_in_confirmed", actor: "ai_assistant" } },
      });
      if (lease.convertedFrom) {
        await prisma.activityEvent.create({
          data: { organizationId, actorId: userId, entityType: "application", entityId: lease.convertedFrom.id, eventType: "status_changed", metadata: { action: "move_in_confirmed", leaseId, actor: "ai_assistant" } },
        });
      }
      const tenant = lease.tenants[0]?.tenant;
      return `Move-in confirmed for ${tenant ? `**${tenant.firstName} ${tenant.lastName}**` : "lease"}.`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}
