import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import OpenAI from "openai";

export const maxDuration = 60;

type PortfolioSnapshot = Awaited<ReturnType<typeof buildPortfolioSnapshot>>;

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

function numberValue(value: unknown) {
  return Number(value ?? 0);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function monthsAgo(months: number) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - months, 1);
}

async function buildPortfolioSnapshot(organizationId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const lastTwelveMonths = monthsAgo(11);

  const [
    properties,
    transactions,
    overduePayments,
    openMaintenance,
    expiringLeases,
    pendingApplications,
  ] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId, archivedAt: null },
      include: {
        units: {
          include: {
            leases: {
              orderBy: { startDate: "desc" },
              include: { tenants: { include: { tenant: true } } },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.findMany({
      where: { organizationId, date: { gte: lastTwelveMonths } },
      include: { property: { select: { id: true, name: true } }, unit: { select: { unitNumber: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.rentPayment.findMany({
      where: { organizationId, status: { in: ["overdue", "partial", "pending"] }, dueDate: { lt: now } },
      include: {
        lease: {
          include: {
            unit: { include: { property: true } },
            tenants: { include: { tenant: true } },
          },
        },
      },
    }),
    prisma.maintenanceRequest.findMany({
      where: { organizationId, status: { in: ["open", "in_progress", "pending_parts"] } },
      include: { property: true, unit: true },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    prisma.lease.findMany({
      where: {
        organizationId,
        status: "active",
        endDate: {
          gte: now,
          lte: new Date(now.getFullYear(), now.getMonth() + 4, now.getDate()),
        },
      },
      include: { unit: { include: { property: true } }, tenants: { include: { tenant: true } } },
      orderBy: { endDate: "asc" },
    }),
    prisma.application.findMany({
      where: { organizationId, status: { in: ["pending", "documents_requested", "under_review", "screening"] } },
      include: { property: { select: { name: true } }, unit: { select: { unitNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const units = properties.flatMap((property) =>
    property.units.map((unit) => {
      const activeLease = unit.leases.find((lease) => lease.status === "active");
      const lastLease = unit.leases.find((lease) => lease.status !== "active");
      return { property, unit, activeLease, lastLease };
    }),
  );

  const activeUnits = units.filter((row) => row.activeLease);
  const vacantUnits = units.filter((row) => !row.activeLease);
  const activeRents = activeUnits.map((row) => numberValue(row.activeLease?.rentAmount));
  const portfolioMedianRent = median(activeRents);

  const vacantUnitDetails = vacantUnits.map((row) => {
    const samePropertyRents = activeUnits
      .filter((active) => active.property.id === row.property.id)
      .map((active) => numberValue(active.activeLease?.rentAmount));
    const sameLayoutRents = activeUnits
      .filter((active) =>
        active.unit.bedrooms?.toString() === row.unit.bedrooms?.toString()
        && active.unit.bathrooms?.toString() === row.unit.bathrooms?.toString()
      )
      .map((active) => numberValue(active.activeLease?.rentAmount));
    const projectedRent = median(samePropertyRents)
      || median(sameLayoutRents)
      || numberValue(row.lastLease?.rentAmount)
      || portfolioMedianRent;
    const vacantSince = row.lastLease?.endDate ?? row.unit.createdAt;
    const daysVacant = Math.max(0, Math.floor((now.getTime() - new Date(vacantSince).getTime()) / 86400000));

    return {
      unitId: row.unit.id,
      propertyName: row.property.name,
      unitNumber: row.unit.unitNumber,
      city: row.property.city,
      bedrooms: row.unit.bedrooms == null ? null : numberValue(row.unit.bedrooms),
      bathrooms: row.unit.bathrooms == null ? null : numberValue(row.unit.bathrooms),
      sqft: row.unit.sqft,
      daysVacant,
      lastRent: row.lastLease ? numberValue(row.lastLease.rentAmount) : null,
      projectedRent: Math.round(projectedRent),
      annualOpportunity: Math.round(projectedRent * 12),
    };
  });

  const monthlyPotentialRent = activeRents.reduce((sum, rent) => sum + rent, 0)
    + vacantUnitDetails.reduce((sum, unit) => sum + unit.projectedRent, 0);
  const monthlyActualRentRoll = activeRents.reduce((sum, rent) => sum + rent, 0);
  const vacancyLossMonthly = monthlyPotentialRent - monthlyActualRentRoll;

  const income12 = transactions
    .filter((txn) => txn.type === "income")
    .reduce((sum, txn) => sum + numberValue(txn.amount), 0);
  const expenses12 = transactions
    .filter((txn) => txn.type === "expense")
    .reduce((sum, txn) => sum + numberValue(txn.amount), 0);
  const net12 = income12 - expenses12;

  const incomeYtd = transactions
    .filter((txn) => txn.type === "income" && txn.date >= startOfYear)
    .reduce((sum, txn) => sum + numberValue(txn.amount), 0);
  const expensesYtd = transactions
    .filter((txn) => txn.type === "expense" && txn.date >= startOfYear)
    .reduce((sum, txn) => sum + numberValue(txn.amount), 0);
  const incomeMonth = transactions
    .filter((txn) => txn.type === "income" && txn.date >= startOfMonth)
    .reduce((sum, txn) => sum + numberValue(txn.amount), 0);
  const expensesMonth = transactions
    .filter((txn) => txn.type === "expense" && txn.date >= startOfMonth)
    .reduce((sum, txn) => sum + numberValue(txn.amount), 0);

  const expensesByCategory = Object.values(transactions
    .filter((txn) => txn.type === "expense")
    .reduce<Record<string, { category: string; amount: number; count: number }>>((acc, txn) => {
      acc[txn.category] ??= { category: txn.category, amount: 0, count: 0 };
      acc[txn.category].amount += numberValue(txn.amount);
      acc[txn.category].count += 1;
      return acc;
    }, {}))
    .sort((a, b) => b.amount - a.amount);

  const expensesByProperty = Object.values(transactions
    .filter((txn) => txn.type === "expense")
    .reduce<Record<string, { propertyName: string; amount: number; count: number }>>((acc, txn) => {
      const key = txn.property?.id ?? "unassigned";
      acc[key] ??= { propertyName: txn.property?.name ?? "Unassigned", amount: 0, count: 0 };
      acc[key].amount += numberValue(txn.amount);
      acc[key].count += 1;
      return acc;
    }, {}))
    .sort((a, b) => b.amount - a.amount);

  const excessiveExpenseSignals = expensesByProperty
    .filter((property) => property.amount > Math.max(3000, expenses12 * 0.18))
    .slice(0, 5);

  const overdueBalance = overduePayments.reduce((sum, payment) => {
    const owed = numberValue(payment.amountDue) - numberValue(payment.amountPaid);
    return owed > 0 ? sum + owed : sum;
  }, 0);

  const rentComparisonGroups = Object.values(activeUnits.reduce<Record<string, { label: string; rents: number[] }>>((acc, row) => {
    const bedrooms = row.unit.bedrooms == null ? "unknown" : `${numberValue(row.unit.bedrooms)} bed`;
    const bathrooms = row.unit.bathrooms == null ? "unknown bath" : `${numberValue(row.unit.bathrooms)} bath`;
    const key = `${bedrooms}-${bathrooms}`;
    acc[key] ??= { label: `${bedrooms}, ${bathrooms}`, rents: [] };
    acc[key].rents.push(numberValue(row.activeLease?.rentAmount));
    return acc;
  }, {})).map((group) => ({
    label: group.label,
    medianRent: Math.round(median(group.rents)),
    lowRent: Math.min(...group.rents),
    highRent: Math.max(...group.rents),
    unitCount: group.rents.length,
  }));

  return {
    generatedAt: now.toISOString(),
    portfolio: {
      propertyCount: properties.length,
      unitCount: units.length,
      occupiedUnits: activeUnits.length,
      vacantUnits: vacantUnits.length,
      occupancyRate: units.length ? Math.round((activeUnits.length / units.length) * 100) : 0,
      monthlyActualRentRoll: Math.round(monthlyActualRentRoll),
      monthlyPotentialRent: Math.round(monthlyPotentialRent),
      vacancyLossMonthly: Math.round(vacancyLossMonthly),
      vacancyLossAnnual: Math.round(vacancyLossMonthly * 12),
      medianActiveRent: Math.round(portfolioMedianRent),
    },
    financials: {
      trailingTwelveMonths: {
        income: Math.round(income12),
        expenses: Math.round(expenses12),
        net: Math.round(net12),
        expenseRatio: income12 > 0 ? Math.round((expenses12 / income12) * 100) : null,
      },
      yearToDate: {
        income: Math.round(incomeYtd),
        expenses: Math.round(expensesYtd),
        net: Math.round(incomeYtd - expensesYtd),
      },
      currentMonth: {
        income: Math.round(incomeMonth),
        expenses: Math.round(expensesMonth),
        net: Math.round(incomeMonth - expensesMonth),
      },
      expensesByCategory: expensesByCategory.slice(0, 8).map((item) => ({ ...item, amount: Math.round(item.amount) })),
      expensesByProperty: expensesByProperty.slice(0, 8).map((item) => ({ ...item, amount: Math.round(item.amount) })),
      excessiveExpenseSignals: excessiveExpenseSignals.map((item) => ({ ...item, amount: Math.round(item.amount) })),
    },
    vacancies: vacantUnitDetails.sort((a, b) => b.annualOpportunity - a.annualOpportunity).slice(0, 12),
    rentComparisonGroups,
    risks: {
      overdueTenantCount: new Set(overduePayments.map((payment) => payment.lease.tenants[0]?.tenant.id).filter(Boolean)).size,
      overdueBalance: Math.round(overdueBalance),
      openMaintenanceCount: openMaintenance.length,
      emergencyMaintenanceCount: openMaintenance.filter((request) => request.priority === "emergency").length,
      expiringLeaseCount: expiringLeases.length,
      pendingApplicationCount: pendingApplications.length,
    },
    focusItems: {
      overduePayments: overduePayments.slice(0, 8).map((payment) => {
        const tenant = payment.lease.tenants[0]?.tenant;
        return {
          tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : "Unknown tenant",
          propertyName: payment.lease.unit.property.name,
          unitNumber: payment.lease.unit.unitNumber,
          owed: Math.round(Math.max(0, numberValue(payment.amountDue) - numberValue(payment.amountPaid))),
          dueDate: payment.dueDate.toISOString(),
        };
      }),
      openMaintenance: openMaintenance.slice(0, 8).map((request) => ({
        title: request.title,
        priority: request.priority,
        status: request.status,
        propertyName: request.property.name,
        unitNumber: request.unit?.unitNumber ?? null,
        estimatedCost: request.estimatedCost == null ? null : Math.round(numberValue(request.estimatedCost)),
      })),
      expiringLeases: expiringLeases.slice(0, 8).map((lease) => {
        const tenant = lease.tenants[0]?.tenant;
        return {
          tenantName: tenant ? `${tenant.firstName} ${tenant.lastName}` : "Unknown tenant",
          propertyName: lease.unit.property.name,
          unitNumber: lease.unit.unitNumber,
          rentAmount: Math.round(numberValue(lease.rentAmount)),
          endDate: lease.endDate?.toISOString() ?? null,
        };
      }),
      pendingApplications: pendingApplications.map((application) => ({
        applicantName: `${application.firstName} ${application.lastName}`,
        status: application.status,
        propertyName: application.property.name,
        unitNumber: application.unit?.unitNumber ?? null,
      })),
    },
  };
}

function fallbackAnalysis(snapshot: PortfolioSnapshot) {
  const vacancyLoss = snapshot.portfolio.vacancyLossMonthly;
  const topExpense = snapshot.financials.expensesByCategory[0];
  const topVacancy = snapshot.vacancies[0];

  return {
    executiveSummary: [
      snapshot.portfolio.vacantUnits > 0
        ? `Vacancy is the clearest income lever: ${snapshot.portfolio.vacantUnits} vacant units represent about ${formatCurrency(vacancyLoss)} in monthly rent opportunity.`
        : "The portfolio is fully occupied, so the near-term focus should shift to collections, renewals, and expense control.",
      snapshot.financials.trailingTwelveMonths.expenseRatio == null
        ? "There is not enough recorded income to calculate an expense ratio yet."
        : `The trailing 12-month expense ratio is ${snapshot.financials.trailingTwelveMonths.expenseRatio}%.`,
      snapshot.risks.overdueBalance > 0
        ? `Collections need attention: open rent balances total ${formatCurrency(snapshot.risks.overdueBalance)}.`
        : "No past-due rent balance is currently visible in the data.",
    ],
    priorityScore: snapshot.portfolio.occupancyRate >= 95 && snapshot.risks.overdueBalance === 0 ? 82 : 68,
    focusAreas: [
      {
        title: "Lease vacant units first",
        why: topVacancy
          ? `${topVacancy.propertyName} unit ${topVacancy.unitNumber} has the largest visible annual opportunity at ${formatCurrency(topVacancy.annualOpportunity)}.`
          : "No vacant units are currently visible.",
        impact: formatCurrency(snapshot.portfolio.vacancyLossAnnual),
        urgency: snapshot.portfolio.vacantUnits > 0 ? "high" : "low",
      },
      {
        title: "Audit the largest expense category",
        why: topExpense
          ? `${topExpense.category.replace("_", " ")} is the largest trailing 12-month expense category at ${formatCurrency(topExpense.amount)}.`
          : "No expense history is currently recorded.",
        impact: topExpense ? `Potential savings if reduced 10%: ${formatCurrency(topExpense.amount * 0.1)}` : "Unknown",
        urgency: topExpense ? "medium" : "low",
      },
      {
        title: "Tighten collections",
        why: `${snapshot.risks.overdueTenantCount} tenants have visible past-due or partial balances.`,
        impact: formatCurrency(snapshot.risks.overdueBalance),
        urgency: snapshot.risks.overdueBalance > 0 ? "high" : "low",
      },
    ],
    projectPlan: {
      name: "Portfolio performance improvement plan",
      goal: "Increase monthly net income by filling vacancy, protecting rent roll, and reducing avoidable expense leakage.",
      projectedMonthlyUpside: formatCurrency(snapshot.portfolio.vacancyLossMonthly),
      phases: [
        {
          name: "Week 1: triage",
          actions: ["Rank vacant units by projected rent", "Contact past-due tenants", "Review the top expense category"],
          expectedOutcome: "Clear list of highest-value actions.",
        },
        {
          name: "Weeks 2-4: revenue recovery",
          actions: ["Prepare and market priority vacancies", "Push pending applications to decisions", "Renew leases expiring soon"],
          expectedOutcome: "Vacancy loss starts converting into rent roll.",
        },
        {
          name: "Days 30-90: operating discipline",
          actions: ["Compare vendors on high-cost categories", "Set monthly expense review cadence", "Standardize renewal rent review"],
          expectedOutcome: "More predictable net operating income.",
        },
      ],
    },
    rentStrategy: snapshot.vacancies.slice(0, 5).map((unit) => ({
      unit: `${unit.propertyName} Unit ${unit.unitNumber}`,
      currentOrLastRent: unit.lastRent ? formatCurrency(unit.lastRent) : "No prior rent",
      suggestedRent: formatCurrency(unit.projectedRent),
      rationale: "Based on active rents in the same property/layout where available, then portfolio median rent.",
    })),
    expenseWatchlist: snapshot.financials.expensesByCategory.slice(0, 5).map((expense) => ({
      category: expense.category,
      amount: formatCurrency(expense.amount),
      recommendation: "Review recent invoices, vendor pricing, and whether this is recurring or one-time.",
    })),
    nextActions: [
      "Start with the highest projected rent vacancy.",
      "Review every expense category above 15% of trailing 12-month expenses.",
      "Contact tenants with past-due balances before adding new discretionary work.",
      "Use expiring leases to reset under-market rents where legally and contractually allowed.",
    ],
    caveats: ["This is planning support based on data in GHM, not licensed financial, tax, or legal advice."],
  };
}

async function generateAnalysis(snapshot: PortfolioSnapshot) {
  const client = getOpenAIClient();
  if (!client) return fallbackAnalysis(snapshot);

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 2500,
    messages: [
      {
        role: "system",
        content: [
          "You are a senior property portfolio analyst for a landlord.",
          "Analyze only the provided GHM portfolio data. Do not invent comps, legal rules, cap rates, or market facts.",
          "Be concrete, numerical, and action-oriented. Treat this as planning support, not licensed financial advice.",
          "Return valid JSON with these keys: executiveSummary string[], priorityScore number, focusAreas array of {title, why, impact, urgency}, projectPlan {name, goal, projectedMonthlyUpside, phases array of {name, actions string[], expectedOutcome}}, rentStrategy array of {unit, currentOrLastRent, suggestedRent, rationale}, expenseWatchlist array of {category, amount, recommendation}, nextActions string[], caveats string[].",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify(snapshot),
      },
    ],
  });

  const content = response.choices[0]?.message.content;
  if (!content) return fallbackAnalysis(snapshot);

  try {
    return JSON.parse(content);
  } catch {
    return fallbackAnalysis(snapshot);
  }
}

export async function POST() {
  try {
    const { organizationId } = await requireOrg();
    const snapshot = await buildPortfolioSnapshot(organizationId);
    const analysis = await generateAnalysis(snapshot);

    return Response.json({ snapshot, analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to analyze portfolio";
    const status = message === "Unauthorized" ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
