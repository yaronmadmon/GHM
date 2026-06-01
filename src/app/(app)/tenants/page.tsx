import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, CircleDollarSign, CreditCard, FileText, Mail, Phone, Plus, Receipt, ScrollText, Users } from "lucide-react";
import { daysUntil, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { TenantPaymentButton } from "@/components/tenants/TenantPaymentButton";
import { leaseMonthlyDueForPeriod } from "@/lib/monthly-charges";
import { calculateLeaseOutstandingBalance } from "@/lib/rent-ledger";

function latestDate(dates: Array<Date | null | undefined>) {
  return dates
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
}

export default async function TenantsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const orgId = session.user.organizationId;

  const activeLeases = await prisma.lease.findMany({
    where: { organizationId: orgId, status: "active" },
    include: {
      unit: { include: { property: true } },
      tenants: {
        include: {
          tenant: {
            include: {
              convertedFrom: { include: { documents: { select: { id: true } } } },
            },
          },
        },
        orderBy: { isPrimary: "desc" },
      },
      documents: { select: { id: true } },
      rentPayments: { orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }] },
      transactions: true,
      monthlyCharges: true,
    },
    orderBy: { createdAt: "asc" },
  });

  type LeaseRow = (typeof activeLeases)[0];
  const unitMap = new Map<string, { lease: LeaseRow; tenants: LeaseRow["tenants"] }>();
  for (const lease of activeLeases) {
    const existing = unitMap.get(lease.unitId);
    if (existing) {
      const seen = new Set(existing.tenants.map((lt) => lt.tenantId));
      for (const lt of lease.tenants) {
        if (!seen.has(lt.tenantId)) {
          existing.tenants.push(lt);
          seen.add(lt.tenantId);
        }
      }
    } else {
      unitMap.set(lease.unitId, { lease, tenants: [...lease.tenants] });
    }
  }
  const groupedUnits = [...unitMap.values()];

  const tenantIdsWithLease = new Set(activeLeases.flatMap((l) => l.tenants.map((lt) => lt.tenantId)));
  const unattached = await prisma.tenant.findMany({
    where: { organizationId: orgId, id: { notIn: [...tenantIdsWithLease] } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const totalTenants = tenantIdsWithLease.size + unattached.length;
  const now = new Date();
  const currentPeriodYear = now.getFullYear();
  const currentPeriodMonth = now.getMonth() + 1;

  return (
    <div className="page-shell page-stack">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">Residents</p>
          <h1 className="page-title mt-2">Tenants</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {totalTenants} tenant{totalTenants !== 1 ? "s" : ""} across {groupedUnits.length} active unit{groupedUnits.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/tenants/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add tenant
          </Button>
        </Link>
      </div>

      {totalTenants === 0 ? (
        <div className="empty-state">
          <Users className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="font-heading text-3xl font-semibold">No tenants yet</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">Add tenants and link them to leases so rent, messages, and documents stay organized.</p>
          <Link href="/tenants/new" className="mt-5">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add tenant
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groupedUnits.map(({ lease, tenants }) => {
            const tenantList = tenants.map((lt) => lt.tenant);
            const primary = tenantList[0];
            if (!primary) return null;
            const leaseDocCount = lease.documents.length;
            const appDocCount = tenants.reduce(
              (sum, lt) => sum + (lt.tenant.convertedFrom?.documents.length ?? 0),
              0,
            );
            const totalDocCount = leaseDocCount + appDocCount;
            const monthlyDue = leaseMonthlyDueForPeriod(lease.rentAmount, lease.monthlyCharges, currentPeriodYear, currentPeriodMonth);
            const currentPayment = lease.rentPayments.find(
              (payment) => payment.periodYear === currentPeriodYear && payment.periodMonth === currentPeriodMonth,
            );
            const collectedThisMonth = Number(currentPayment?.amountPaid ?? 0);
            const currentBalance = calculateLeaseOutstandingBalance({
              rentPayments: lease.rentPayments,
              transactions: lease.transactions,
            });
            const lastReceipt = latestDate(lease.rentPayments.map((payment) => payment.paidAt ?? null));
            const leaseEndsIn = daysUntil(lease.endDate);
            const leaseEndingSoon = leaseEndsIn !== null && leaseEndsIn >= 0 && leaseEndsIn <= 60;
            const portalActive = tenantList.some((tenant) => Boolean(tenant.portalUserId));
            const paymentPeriods = lease.rentPayments.map((payment) => ({
              periodYear: payment.periodYear,
              periodMonth: payment.periodMonth,
              amountDue: Number(payment.amountDue),
              amountPaid: Number(payment.amountPaid),
              status: payment.status,
            }));
            return (
              <article key={lease.unitId} className="relative rounded-lg border bg-card p-4 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md">
                <Link
                  href={`/tenants/${primary.id}`}
                  className="absolute inset-0 z-0 rounded-lg"
                  aria-label={`Open tenant file for ${primary.firstName} ${primary.lastName}`}
                />
                <div className="relative z-10 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex -space-x-2">
                      {tenantList.slice(0, 3).map((tenant) => (
                        <div key={tenant.id} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-card bg-primary/10 font-semibold text-primary shadow-sm">
                          {getInitials(`${tenant.firstName} ${tenant.lastName}`)}
                        </div>
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-emerald-200 text-xs text-emerald-700 dark:border-emerald-900 dark:text-emerald-300">Active</Badge>
                        <Badge variant={currentBalance > 0 ? "destructive" : "secondary"} className="text-xs">
                          {currentBalance > 0 ? "Balance due" : "Current"}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {lease.unit.property.name} - Unit {lease.unit.unitNumber}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 border-t pt-3">
                    {tenantList.map((tenant, index) => (
                      <div key={tenant.id}>
                        <Link href={`/tenants/${tenant.id}`} className="relative z-10 text-sm font-semibold hover:text-primary">
                          {tenant.firstName} {tenant.lastName}
                          {index === 0 && tenantList.length > 1 && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">(primary)</span>
                          )}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {tenant.email && (
                            <a href={`mailto:${tenant.email}`} className="relative z-10 flex items-center gap-1 hover:text-primary">
                              <Mail className="h-3 w-3" />
                              {tenant.email}
                            </a>
                          )}
                          {tenant.phone && (
                            <a href={`tel:${tenant.phone}`} className="relative z-10 flex items-center gap-1 hover:text-primary">
                              <Phone className="h-3 w-3" />
                              {tenant.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/30 p-3">
                    <div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CircleDollarSign className="h-3.5 w-3.5" />
                        Balance
                      </p>
                      <p className={`mt-1 font-mono text-sm font-semibold ${currentBalance > 0 ? "text-destructive" : currentBalance < 0 ? "text-emerald-600" : ""}`}>
                        {formatCurrency(currentBalance)}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Receipt className="h-3.5 w-3.5" />
                        Due
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold">{formatCurrency(monthlyDue)}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CreditCard className="h-3.5 w-3.5" />
                        Collected
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold">{formatCurrency(collectedThisMonth)}</p>
                    </div>
                  </div>

                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Lease ends {lease.endDate ? formatDate(lease.endDate) : "MTM"}
                      {leaseEndingSoon ? " soon" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Receipt className="h-3.5 w-3.5" />
                      Last receipt {lastReceipt ? formatDate(lastReceipt) : "--"}
                    </span>
                    <span className="flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5" />
                      {portalActive ? "Portal active" : "Portal not active"}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {totalDocCount} doc{totalDocCount !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="relative z-10 flex flex-wrap items-center gap-2 border-t pt-3">
                    <TenantPaymentButton
                      leaseId={lease.id}
                      tenantName={`${primary.firstName} ${primary.lastName}`}
                      monthlyDue={monthlyDue}
                      paymentDueDay={lease.paymentDueDay}
                      payments={paymentPeriods}
                      periodYear={currentPeriodYear}
                      periodMonth={currentPeriodMonth}
                      variant={currentBalance > 0 ? "default" : "outline"}
                      size="sm"
                    />
                    <Link href={`/tenants/${primary.id}/ledger`}>
                      <Button size="sm" variant="outline" className="gap-2">
                        <ScrollText className="h-4 w-4" />
                        Ledger
                      </Button>
                    </Link>
                    <Link href={`/leases/${lease.id}`} className="quiet-link text-xs">
                      View lease
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}

          {unattached.map((tenant) => (
            <Link key={tenant.id} href={`/tenants/${tenant.id}`} className="block">
              <article className="rounded-lg border bg-card p-4 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground">
                    {getInitials(`${tenant.firstName} ${tenant.lastName}`)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{tenant.firstName} {tenant.lastName}</h3>
                      <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">No lease</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {tenant.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{tenant.email}</span>}
                      {tenant.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{tenant.phone}</span>}
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
