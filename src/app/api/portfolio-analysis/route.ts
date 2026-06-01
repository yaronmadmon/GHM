import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { calculateLeaseOutstandingBalance } from "@/lib/rent-ledger";
import { estimatePropertyExpenses } from "@/lib/expense-estimator";
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
    activeLeases,
    openMaintenance,
    expiringLeases,
    pendingApplications,
  ] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId, archivedAt: null },
      include: {
        expenses: true,
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
      include: {
        property: { select: { id: true, name: true } },
        unit: { select: { unitNumber: true } },
        lease: { select: { id: true } },
      },
      orderBy: { date: "desc" },
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

  // Build trailing-12-month period keys for RentPayment filtering
  const trailing12PeriodKeys = new Set(
    Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return `${d.getFullYear()}-${d.getMonth() + 1}`;
    }),
  );

  // All rent payments from active leases, indexed by period
  const allRentPayments = activeLeases.flatMap((l) => l.rentPayments);

  // Income from RentPayment table (authoritative for actual rent received)
  // Use Math.max(0, ...) to ignore negative/credit entries in amountPaid
  const rentCollected12 = allRentPayments
    .filter((rp) => trailing12PeriodKeys.has(`${rp.periodYear}-${rp.periodMonth}`))
    .reduce((sum, rp) => sum + Math.max(0, numberValue(rp.amountPaid)), 0);
  const rentCollectedYtd = allRentPayments
    .filter((rp) => rp.periodYear === now.getFullYear())
    .reduce((sum, rp) => sum + Math.max(0, numberValue(rp.amountPaid)), 0);
  const rentCollectedMonth = allRentPayments
    .filter((rp) => rp.periodYear === now.getFullYear() && rp.periodMonth === now.getMonth() + 1)
    .reduce((sum, rp) => sum + Math.max(0, numberValue(rp.amountPaid)), 0);

  // Non-rent transaction income (late fees, deposits, etc.)
  // Exclude category="rent" transactions — those are rent charge records, not cash received.
  // The RentPayment table is the authoritative source for rent income.
  const isNonRentIncome = (txn: { type: string; category: string }) =>
    txn.type === "income" && txn.category !== "rent";

  const otherIncome12 = transactions
    .filter(isNonRentIncome)
    .reduce((sum, txn) => sum + numberValue(txn.amount), 0);
  const otherIncomeYtd = transactions
    .filter((txn) => isNonRentIncome(txn) && txn.date >= startOfYear)
    .reduce((sum, txn) => sum + numberValue(txn.amount), 0);
  const otherIncomeMonth = transactions
    .filter((txn) => isNonRentIncome(txn) && txn.date >= startOfMonth)
    .reduce((sum, txn) => sum + numberValue(txn.amount), 0);

  const income12 = rentCollected12 + otherIncome12;
  const incomeYtd = rentCollectedYtd + otherIncomeYtd;
  const incomeMonth = rentCollectedMonth + otherIncomeMonth;

  const expenses12 = transactions
    .filter((txn) => txn.type === "expense")
    .reduce((sum, txn) => sum + numberValue(txn.amount), 0);
  const net12 = income12 - expenses12;

  const expensesYtd = transactions
    .filter((txn) => txn.type === "expense" && txn.date >= startOfYear)
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

  const monthlyKnownPropertyExpenses = properties.reduce((sum, property) => {
    const exp = property.expenses;
    if (!exp) return sum;
    return sum + [exp.propertyTaxMonthly, exp.waterSewerMonthly, exp.electricityMonthly, exp.gasMonthly,
      exp.insuranceMonthly, exp.mortgageMonthly, exp.hoaMonthly, exp.otherMonthly]
      .reduce((innerSum, value) => innerSum + (value !== null ? Number(value) : 0), 0);
  }, 0);

  const overdueItems = activeLeases
    .map((lease) => {
      const tenant = lease.tenants[0]?.tenant;
      const owed = calculateLeaseOutstandingBalance({ rentPayments: lease.rentPayments, transactions: lease.transactions });
      return {
        lease,
        tenant,
        owed,
      };
    })
    .filter((item) => item.tenant && item.owed > 0)
    .sort((a, b) => b.owed - a.owed);
  const overdueBalance = overdueItems.reduce((sum, item) => sum + item.owed, 0);

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

  const overdueByProperty = overdueItems.reduce<Record<string, { count: number; balance: number }>>((acc, item) => {
    const propId = item.lease.unit.property.id;
    acc[propId] ??= { count: 0, balance: 0 };
    acc[propId].count += 1;
    acc[propId].balance += item.owed;
    return acc;
  }, {});

  const maintenanceByProperty = openMaintenance.reduce<Record<string, number>>((acc, req) => {
    acc[req.property.id] = (acc[req.property.id] ?? 0) + 1;
    return acc;
  }, {});

  const propertyDetails = properties.map((property) => {
    const propUnits = units.filter((u) => u.property.id === property.id);
    const propActiveUnits = propUnits.filter((u) => u.activeLease);
    const monthlyRentRoll = propActiveUnits.reduce((sum, u) => sum + numberValue(u.activeLease?.rentAmount), 0);
    const exp = property.expenses;
    const expenseBreakdown = exp ? {
      propertyTaxMonthly: exp.propertyTaxMonthly == null ? null : Math.round(Number(exp.propertyTaxMonthly)),
      waterSewerMonthly: exp.waterSewerMonthly == null ? null : Math.round(Number(exp.waterSewerMonthly)),
      electricityMonthly: exp.electricityMonthly == null ? null : Math.round(Number(exp.electricityMonthly)),
      gasMonthly: exp.gasMonthly == null ? null : Math.round(Number(exp.gasMonthly)),
      insuranceMonthly: exp.insuranceMonthly == null ? null : Math.round(Number(exp.insuranceMonthly)),
      mortgageMonthly: exp.mortgageMonthly == null ? null : Math.round(Number(exp.mortgageMonthly)),
      hoaMonthly: exp.hoaMonthly == null ? null : Math.round(Number(exp.hoaMonthly)),
      otherMonthly: exp.otherMonthly == null ? null : Math.round(Number(exp.otherMonthly)),
    } : null;
    const monthlyExpenses = exp
      ? [exp.propertyTaxMonthly, exp.waterSewerMonthly, exp.electricityMonthly, exp.gasMonthly,
         exp.insuranceMonthly, exp.mortgageMonthly, exp.hoaMonthly, exp.otherMonthly]
          .reduce((sum, v) => sum + (v !== null ? Number(v) : 0), 0)
      : null;
    const overdueInfo = overdueByProperty[property.id] ?? { count: 0, balance: 0 };
    return {
      id: property.id,
      name: property.name,
      address: `${property.addressLine1}, ${property.city}, ${property.state}`,
      addressLine1: property.addressLine1,
      city: property.city,
      state: property.state,
      zip: property.zip,
      unitCount: propUnits.length,
      occupiedUnits: propActiveUnits.length,
      occupancyRate: propUnits.length ? Math.round((propActiveUnits.length / propUnits.length) * 100) : 0,
      monthlyRentRoll: Math.round(monthlyRentRoll),
      monthlyExpenses: monthlyExpenses !== null ? Math.round(monthlyExpenses) : null,
      expenseBreakdown,
      hasExpenses: exp !== null,
      missingExpenseCategories: expenseBreakdown
        ? Object.entries(expenseBreakdown).filter(([, value]) => value === null).map(([key]) => key)
        : ["propertyTaxMonthly", "waterSewerMonthly", "electricityMonthly", "gasMonthly", "insuranceMonthly", "mortgageMonthly", "hoaMonthly", "otherMonthly"],
      openMaintenanceCount: maintenanceByProperty[property.id] ?? 0,
      overdueTenantCount: overdueInfo.count,
      overdueBalance: Math.round(overdueInfo.balance),
    };
  });

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
      currentMonthlyNet: Math.round(incomeMonth - expensesMonth),
      knownRecurringExpensesMonthly: Math.round(monthlyKnownPropertyExpenses),
    },
    financials: {
      trailingTwelveMonths: {
        income: Math.round(income12),
        rentCollected: Math.round(rentCollected12),
        otherIncome: Math.round(otherIncome12),
        expenses: Math.round(expenses12),
        net: Math.round(net12),
        expenseRatio: income12 > 0 ? Math.round((expenses12 / income12) * 100) : null,
      },
      yearToDate: {
        income: Math.round(incomeYtd),
        rentCollected: Math.round(rentCollectedYtd),
        expenses: Math.round(expensesYtd),
        net: Math.round(incomeYtd - expensesYtd),
      },
      currentMonth: {
        income: Math.round(incomeMonth),
        rentCollected: Math.round(rentCollectedMonth),
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
      overdueTenantCount: overdueItems.length,
      overdueBalance: Math.round(overdueBalance),
      openMaintenanceCount: openMaintenance.length,
      emergencyMaintenanceCount: openMaintenance.filter((request) => request.priority === "emergency").length,
      expiringLeaseCount: expiringLeases.length,
      pendingApplicationCount: pendingApplications.length,
    },
    dataSources: {
      rentRoll: { source: "Lease.rentAmount on active leases", confidence: activeLeases.length > 0 ? "high" : "low" },
      rentCollected: { source: "RentPayment.amountPaid records", confidence: allRentPayments.length > 0 ? "high" : "low" },
      tenantBalances: { source: "RentPayment ledger plus imported ledger running balances when present", confidence: activeLeases.length > 0 ? "high" : "low" },
      transactionExpenses: { source: "Transaction rows where type=expense from trailing 12 months", confidence: expensesByCategory.length > 0 ? "high" : "low" },
      recurringExpenses: { source: "PropertyExpenses records for taxes, insurance, mortgage, utilities, HOA, and other monthly expenses", confidence: properties.every((p) => p.expenses) ? "high" : properties.some((p) => p.expenses) ? "medium" : "low" },
      maintenance: { source: "MaintenanceRequest open/in_progress/pending_parts records", confidence: "high" },
      vacancyOpportunity: { source: "Vacant units estimated from same-property rents, same-layout rents, prior rent, then portfolio median", confidence: vacantUnitDetails.some((unit) => unit.lastRent != null) || activeRents.length > 0 ? "medium" : "low" },
    },
    dataQuality: {
      missingExpenseProperties: propertyDetails.filter((property) => !property.hasExpenses).map((property) => property.name),
      partialExpenseProperties: propertyDetails
        .filter((property) => property.hasExpenses && property.missingExpenseCategories.length > 0)
        .map((property) => ({
          propertyName: property.name,
          missing: property.missingExpenseCategories,
        })),
      warnings: [
        properties.some((property) => !property.expenses)
          ? `${properties.filter((property) => !property.expenses).length} properties are missing recurring expense settings, so taxes/mortgage/insurance cash-flow analysis may be understated.`
          : null,
        expensesByCategory.length === 0 ? "No trailing 12-month expense transactions are recorded." : null,
        allRentPayments.length === 0 ? "No rent payment rows are recorded, so collected-rent analysis is limited." : null,
      ].filter((warning): warning is string => Boolean(warning)),
    },
    calculationNotes: {
      income: "financials.*.income = rentCollected (from RentPayment records) + otherIncome (late fees, deposits, etc. from Transaction records, excluding rent-charge category). Does NOT double-count: rent-category Transactions are charges owed, not cash received.",
      rentRoll: "portfolio.monthlyActualRentRoll is the sum of active lease rent amounts — the contractual obligation. rentCollected is the actual cash received per the payment ledger.",
      overdueBalance: "Net open balance across active lease ledgers, calculated from rent payment rows plus imported ledger transactions. It uses recorded app data only.",
      vacancyLoss: "Estimated from vacant units multiplied by comparable in-portfolio rents when available, then prior rent or portfolio median rent.",
      expenses: "Uses actual Transaction rows from the trailing 12 months (type=expense) and saved PropertyExpenses records. Missing recurring expense fields are reported as missing instead of estimated.",
    },
    propertyDetails,
    focusItems: {
      overduePayments: overdueItems.slice(0, 8).map((item) => ({
        tenantName: item.tenant ? `${item.tenant.firstName} ${item.tenant.lastName}` : "Unknown tenant",
        propertyName: item.lease.unit.property.name,
        unitNumber: item.lease.unit.unitNumber,
        owed: Math.round(item.owed),
      })),
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

function buildAdvisorPlan(snapshot: PortfolioSnapshot) {
  const topCollections = snapshot.focusItems.overduePayments.slice(0, 5);
  const topVacancies = snapshot.vacancies.slice(0, 5);
  const topExpense = snapshot.financials.expensesByCategory[0];
  const monthlyExpenseSavingsTarget = topExpense ? Math.round((topExpense.amount / 12) * 0.1) : 0;
  const collectionTarget30 = Math.round(
    Math.min(
      snapshot.risks.overdueBalance,
      topCollections.slice(0, 3).reduce((sum, item) => sum + item.owed, 0),
    ),
  );
  const potentialMonthlyNet = snapshot.portfolio.currentMonthlyNet
    + snapshot.portfolio.vacancyLossMonthly
    + monthlyExpenseSavingsTarget;
  const annualUpside = Math.round((snapshot.portfolio.vacancyLossMonthly + monthlyExpenseSavingsTarget) * 12);

  const priorities = [
    snapshot.risks.overdueBalance > 0 ? {
      title: "Collect the largest balances first",
      directive: topCollections.length
        ? `Start with ${topCollections.slice(0, 3).map((item) => `${item.tenantName} (${formatCurrency(item.owed)})`).join(", ")}.`
        : "Review the open balance list and contact tenants with the largest balances.",
      why: `There is ${formatCurrency(snapshot.risks.overdueBalance)} in outstanding tenant balances across ${snapshot.risks.overdueTenantCount} tenants.`,
      impact: `${formatCurrency(collectionTarget30)} practical 30-day collection target from the largest balances.`,
      source: "Active lease ledgers and imported ledger running balances",
      confidence: snapshot.dataSources.tenantBalances.confidence,
    } : null,
    snapshot.portfolio.vacantUnits > 0 ? {
      title: "Recover vacancy income",
      directive: topVacancies.length
        ? `Prepare and list ${topVacancies.slice(0, 3).map((unit) => `${unit.propertyName} ${unit.unitNumber} (${formatCurrency(unit.projectedRent)}/mo)`).join(", ")} first.`
        : "Confirm vacant units and set asking rents from in-portfolio rent history.",
      why: `${snapshot.portfolio.vacantUnits} vacant units represent ${formatCurrency(snapshot.portfolio.vacancyLossMonthly)} per month in recoverable rent roll.`,
      impact: `${formatCurrency(snapshot.portfolio.vacancyLossAnnual)} annual rent-roll upside if all visible vacancies are filled.`,
      source: "Unit vacancy status plus same-property/prior rent estimates",
      confidence: snapshot.dataSources.vacancyOpportunity.confidence,
    } : null,
    topExpense ? {
      title: `Control ${topExpense.category.replace(/_/g, " ")} expense`,
      directive: `Review the invoices behind ${formatCurrency(topExpense.amount)} in trailing ${topExpense.category.replace(/_/g, " ")} expense and decide what is recurring versus one-time.`,
      why: `${topExpense.category.replace(/_/g, " ")} is the largest recorded expense category in the trailing 12 months.`,
      impact: `A 10% reduction would be about ${formatCurrency(monthlyExpenseSavingsTarget)}/mo or ${formatCurrency(monthlyExpenseSavingsTarget * 12)}/yr.`,
      source: "Transaction expense rows from trailing 12 months",
      confidence: snapshot.dataSources.transactionExpenses.confidence,
    } : null,
    snapshot.dataQuality.warnings.length > 0 ? {
      title: "Fix missing financial inputs",
      directive: "Add missing taxes, mortgage, insurance, and utility settings before relying on net cash-flow recommendations.",
      why: snapshot.dataQuality.warnings[0],
      impact: "Improves cash-flow accuracy and prevents understated expense analysis.",
      source: "PropertyExpenses completeness check",
      confidence: snapshot.dataSources.recurringExpenses.confidence,
    } : null,
  ].filter(Boolean);

  return {
    coachBrief: [
      `Today: ${snapshot.portfolio.occupiedUnits}/${snapshot.portfolio.unitCount} units are occupied, current rent roll is ${formatCurrency(snapshot.portfolio.monthlyActualRentRoll)}, and current-month net is ${formatCurrency(snapshot.portfolio.currentMonthlyNet)} from recorded income and expenses.`,
      snapshot.portfolio.vacantUnits > 0
        ? `The main upside is vacancy recovery: filling visible vacancies could move rent roll toward ${formatCurrency(snapshot.portfolio.monthlyPotentialRent)} per month.`
        : "The portfolio is fully occupied, so the main operating levers are collections, renewals, and expense control.",
      snapshot.dataQuality.warnings.length
        ? `Data caution: ${snapshot.dataQuality.warnings[0]}`
        : "The core rent roll, collections, and transaction expense data are available for this review.",
    ],
    potential: {
      today: {
        monthlyRentRoll: snapshot.portfolio.monthlyActualRentRoll,
        monthlyCollectedRent: snapshot.financials.currentMonth.rentCollected,
        currentMonthlyNet: snapshot.portfolio.currentMonthlyNet,
        occupancyRate: snapshot.portfolio.occupancyRate,
        outstandingBalance: snapshot.risks.overdueBalance,
      },
      ifExecuted: {
        monthlyRentRoll: snapshot.portfolio.monthlyPotentialRent,
        vacancyMonthlyUpside: snapshot.portfolio.vacancyLossMonthly,
        monthlyExpenseSavingsTarget,
        projectedMonthlyNet: potentialMonthlyNet,
        annualUpside,
        collectionTarget30,
      },
      assumptions: [
        "Potential rent roll assumes visible vacant units are filled at in-portfolio comparable or prior rents.",
        "Expense improvement uses only the largest recorded trailing-12-month expense category and a conservative 10% reduction target.",
        "Collection target is based on the largest visible tenant balances, not guaranteed cash recovery.",
      ],
    },
    priorities,
    dataConfidence: snapshot.dataSources,
    dataWarnings: snapshot.dataQuality.warnings,
  };
}

function fallbackAnalysis(snapshot: PortfolioSnapshot) {
  const advisorPlan = buildAdvisorPlan(snapshot);
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
    advisorPlan,
  };
}

async function generateAnalysis(snapshot: PortfolioSnapshot) {
  const client = getOpenAIClient();
  if (!client) return fallbackAnalysis(snapshot);
  const advisorPlan = buildAdvisorPlan(snapshot);

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
          "Do not invent property names, expense categories, balances, taxes, mortgages, insurance, trends, causes, or recommendations that are not directly supported by the JSON snapshot.",
          "Use snapshot.dataSources and snapshot.dataQuality. If taxes, mortgage, insurance, or other recurring expenses are missing, call that out instead of estimating.",
          "When discussing collections, use snapshot.risks.overdueBalance only. That number is net unpaid rent and excludes fees/legal/adjustments.",
          "If the snapshot does not contain enough evidence for a claim, say what data is missing instead of guessing.",
          "Be directive, numerical, and action-oriented. The user wants a coach: say exactly what to do first, why, and what upside it could unlock.",
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
    return { ...JSON.parse(content), advisorPlan };
  } catch {
    return fallbackAnalysis(snapshot);
  }
}

async function generateChatAnswer(
  snapshot: PortfolioSnapshot,
  question: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
) {
  const client = getOpenAIClient();
  if (!client) {
    return "I can answer this once the OpenAI API key is configured. Based on the current snapshot, start by reviewing vacancy loss, overdue balances, and the largest expense categories.";
  }

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.25,
    max_tokens: 1200,
    messages: [
      {
        role: "system",
        content: [
          "You are GHM Financial Advisor, a calm and practical financial coach for landlords and property managers.",
          "Use only the provided portfolio snapshot and conversation history. Do not invent external market comps, laws, cap rates, or facts.",
          "Do not invent property names, balances, expense categories, taxes, mortgage costs, insurance costs, trends, or causes. If the answer is not supported by the snapshot, say what data is missing.",
          "Use snapshot.dataSources and snapshot.dataQuality to explain confidence and missing inputs.",
          "IMPORTANT: Income figures use snapshot.financials.*.income which equals rentCollected (actual cash received per payment ledger) + otherIncome (fees/deposits). Do NOT confuse this with portfolio.monthlyActualRentRoll (contractual obligation). Use rentCollected for cash-in-hand analysis.",
          "Collections risk must use snapshot.risks.overdueBalance, which is net unpaid rent only.",
          "Answer in plain English with concrete numbers where possible. Prioritize actions, risks, and tradeoffs.",
          "Keep the response concise: 2-4 short paragraphs or a short bullet list when that is clearer.",
          "This is planning support, not licensed financial, tax, or legal advice.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Current portfolio snapshot:\n${JSON.stringify(snapshot)}`,
      },
      ...history.slice(-8).map((message) => ({
        role: message.role,
        content: message.content,
      })),
      { role: "user", content: question },
    ],
  });

  return response.choices[0]?.message.content
    ?? "I could not generate an answer from the current portfolio snapshot.";
}


export interface PropertyAnalysis {
  propertyId: string;
  healthScore: number;
  priority: "good" | "attention" | "critical";
  issues: string[];
  opportunities: string[];
  summary: string;
}

function fallbackPropertyAnalyses(snapshot: PortfolioSnapshot): PropertyAnalysis[] {
  return (snapshot.propertyDetails ?? []).map((property) => {
    let score = 100;
    if (property.occupancyRate < 100) score -= Math.round((100 - property.occupancyRate) * 0.4);
    if (property.overdueTenantCount > 0) score -= property.overdueTenantCount * 10;
    if (property.openMaintenanceCount > 2) score -= (property.openMaintenanceCount - 2) * 5;
    score = Math.max(0, Math.min(100, score));

    const issues: string[] = [];
    const opportunities: string[] = [];
    if (property.overdueTenantCount > 0) issues.push(`${property.overdueTenantCount} tenant${property.overdueTenantCount > 1 ? "s" : ""} overdue — ${formatCurrency(property.overdueBalance)} at risk`);
    if (property.openMaintenanceCount > 0) issues.push(`${property.openMaintenanceCount} open maintenance request${property.openMaintenanceCount > 1 ? "s" : ""}`);
    if (property.occupancyRate < 100) opportunities.push(`${property.unitCount - property.occupiedUnits} vacant unit${property.unitCount - property.occupiedUnits > 1 ? "s" : ""} — fill to recover rent roll`);
    if (!property.hasExpenses) opportunities.push("Add expense data to enable cash-flow analysis for this property");

    const noi = property.monthlyExpenses !== null ? property.monthlyRentRoll - property.monthlyExpenses : null;
    return {
      propertyId: property.id,
      healthScore: score,
      priority: score >= 80 ? "good" : score >= 60 ? "attention" : "critical",
      issues,
      opportunities,
      summary: noi !== null
        ? `Monthly rent roll ${formatCurrency(property.monthlyRentRoll)}, estimated NOI ${formatCurrency(noi)}.`
        : `Monthly rent roll ${formatCurrency(property.monthlyRentRoll)}, ${property.occupancyRate}% occupied.`,
    };
  });
}

async function generatePropertyAnalyses(snapshot: PortfolioSnapshot): Promise<PropertyAnalysis[]> {
  const client = getOpenAIClient();
  if (!client || !snapshot.propertyDetails?.length) return fallbackPropertyAnalyses(snapshot);

  const propertyData = snapshot.propertyDetails.map((p) => ({
    propertyId: p.id,
    name: p.name,
    address: p.address,
    unitCount: p.unitCount,
    occupiedUnits: p.occupiedUnits,
    occupancyRate: p.occupancyRate,
    monthlyRentRoll: p.monthlyRentRoll,
    monthlyExpenses: p.monthlyExpenses,
    noi: p.monthlyExpenses !== null ? p.monthlyRentRoll - p.monthlyExpenses : null,
    expenseBreakdown: p.expenseBreakdown,
    hasExpenses: p.hasExpenses,
    openMaintenanceCount: p.openMaintenanceCount,
    overdueTenantCount: p.overdueTenantCount,
    overdueBalance: p.overdueBalance,
  }));

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content: [
            "You are a property portfolio analyst. Score and summarize each property using ONLY the provided data.",
            "Do not invent market comps, benchmark rates, legal requirements, or facts not in the data.",
            "healthScore: 0-100 integer. Deduct for vacancies, overdue tenants, overdue balance, open maintenance. Add for full occupancy and positive NOI.",
            "priority: 'critical' if score < 60, 'attention' if 60-79, 'good' if >= 80.",
            "issues: concrete problems with numbers (e.g. '2 overdue tenants — $3,200 at risk'). Empty array if none.",
            "opportunities: specific action opportunities with numbers. Empty array if none.",
            "summary: one sentence combining occupancy, NOI if available, and the most important risk or upside.",
            "Return JSON: { \"properties\": [ { propertyId, healthScore, priority, issues, opportunities, summary } ] }",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify(propertyData),
        },
      ],
    });

    const content = response.choices[0]?.message.content;
    if (!content) return fallbackPropertyAnalyses(snapshot);
    const parsed = JSON.parse(content);
    const arr: PropertyAnalysis[] = Array.isArray(parsed.properties) ? parsed.properties : [];
    return arr.length ? arr : fallbackPropertyAnalyses(snapshot);
  } catch {
    return fallbackPropertyAnalyses(snapshot);
  }
}

export async function POST(req: Request) {
  try {
    const { organizationId } = await requireOrg();
    const body = await req.json().catch(() => ({}));
    const snapshot = await buildPortfolioSnapshot(organizationId);

    if (body.mode === "chat") {
      const question = typeof body.question === "string" ? body.question.trim() : "";
      if (!question) return Response.json({ error: "Question is required" }, { status: 400 });
      const history = Array.isArray(body.history) ? body.history : [];
      const answer = await generateChatAnswer(snapshot, question, history);
      return Response.json({ snapshot, answer });
    }

    // Estimate expenses for properties that don't have them yet (non-fatal)
    const propertiesWithoutExpenses = (snapshot.propertyDetails ?? []).filter((p) => !p.hasExpenses);
    if (propertiesWithoutExpenses.length > 0 && process.env.SERPER_API_KEY) {
      const estimationResults = await Promise.allSettled(
        propertiesWithoutExpenses.map((p) =>
          estimatePropertyExpenses({ addressLine1: p.addressLine1, city: p.city, state: p.state, zip: p.zip ?? "" })
        )
      );

      for (let i = 0; i < estimationResults.length; i++) {
        const result = estimationResults[i];
        if (result.status !== "fulfilled") continue;
        const estimated = result.value;
        const propDetail = propertiesWithoutExpenses[i];

        await prisma.propertyExpenses.upsert({
          where: { propertyId: propDetail.id },
          create: { propertyId: propDetail.id, ...estimated, aiEstimatedAt: new Date() },
          update: { ...estimated, aiEstimatedAt: new Date() },
        });

        const monthlyTotal = (Object.values(estimated) as (number | null)[]).reduce<number>(
          (sum, v) => sum + (v ?? 0), 0
        );
        const idx = snapshot.propertyDetails!.findIndex((p) => p.id === propDetail.id);
        if (idx >= 0) {
          const pd = snapshot.propertyDetails![idx];
          pd.hasExpenses = true;
          pd.monthlyExpenses = Math.round(monthlyTotal);
          pd.expenseBreakdown = {
            propertyTaxMonthly: estimated.propertyTaxMonthly !== null ? Math.round(estimated.propertyTaxMonthly) : null,
            waterSewerMonthly: estimated.waterSewerMonthly !== null ? Math.round(estimated.waterSewerMonthly) : null,
            electricityMonthly: estimated.electricityMonthly !== null ? Math.round(estimated.electricityMonthly) : null,
            gasMonthly: estimated.gasMonthly !== null ? Math.round(estimated.gasMonthly) : null,
            insuranceMonthly: estimated.insuranceMonthly !== null ? Math.round(estimated.insuranceMonthly) : null,
            mortgageMonthly: null,
            hoaMonthly: null,
            otherMonthly: null,
          };
          pd.missingExpenseCategories = Object.entries(estimated)
            .filter(([, v]) => v === null)
            .map(([k]) => k);
        }
      }
    }

    const [analysis, propertyAnalyses] = await Promise.all([
      generateAnalysis(snapshot),
      generatePropertyAnalyses(snapshot),
    ]);

    return Response.json({ snapshot, analysis, propertyAnalyses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to analyze portfolio";
    const status = message === "Unauthorized" ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
