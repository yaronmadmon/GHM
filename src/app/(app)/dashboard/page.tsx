import Link from "next/link";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatRelativeTime, daysUntil } from "@/lib/utils";
import { calculateLeaseOutstandingBalance } from "@/lib/rent-ledger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Building2,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  DollarSign,
  DoorOpen,
  FileText,
  MessageSquare,
  Receipt,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react";

const PRIORITY_ORDER: Record<string, number> = { emergency: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_STYLES: Record<string, string> = {
  emergency: "bg-red-500/10 text-red-700 border-red-200 dark:text-red-300 dark:border-red-900",
  high: "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-900",
  medium: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-900",
  low: "bg-muted text-muted-foreground",
};

async function getDashboardData(organizationId: string, userId: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [
    properties,
    expiringLeases,
    pendingApps,
    activeRentLeases,
    vacancyCount,
    leasePipeline,
    openMaintenance,
    unreadThreads,
    openTasks,
    overdueTasks,
    unpaidBills,
  ] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId, archivedAt: null },
      include: { units: { select: { status: true } } },
    }),
    prisma.lease.findMany({
      where: { organizationId, status: "active", endDate: { gte: now, lte: addDays(now, 60) } },
      include: { unit: { include: { property: true } }, tenants: { include: { tenant: true } } },
      orderBy: { endDate: "asc" },
      take: 5,
    }),
    prisma.application.count({
      where: { organizationId, status: { in: ["pending", "documents_requested", "under_review", "screening"] } },
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
    prisma.unit.count({ where: { property: { organizationId }, leases: { none: { status: "active" } } } }),
    prisma.lease.findMany({
      where: { organizationId, signingStatus: { in: ["draft", "sent", "tenant_signed"] } },
      include: { unit: { include: { property: true } }, tenants: { include: { tenant: true } } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.maintenanceRequest.findMany({
      where: { organizationId, status: { in: ["open", "in_progress", "pending_parts"] } },
      include: { unit: { include: { property: true } } },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    prisma.messageThread.findMany({
      where: {
        organizationId,
        landlordUserId: userId,
        messages: { some: { isRead: false, senderRole: "tenant" } },
      },
      include: {
        messages: {
          where: { isRead: false, senderRole: "tenant" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 5,
    }),
    prisma.task.count({
      where: { organizationId, status: { in: ["open", "in_progress", "waiting"] } },
    }),
    prisma.task.count({
      where: { organizationId, status: { in: ["open", "in_progress", "waiting"] }, dueDate: { lt: new Date() } },
    }),
    prisma.bill.findMany({
      where: { organizationId, status: { in: ["needs_review", "approved"] } },
      select: { id: true, amount: true, dueDate: true, status: true, vendorName: true, vendor: { select: { name: true } }, property: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
  ]);

  const totalExpected = activeRentLeases.reduce((s, lease) => s + Number(lease.rentAmount), 0);
  const totalCollected = activeRentLeases.reduce((s, lease) => {
    const currentPayment = lease.rentPayments.find((p) => p.periodYear === year && p.periodMonth === month);
    return s + Number(currentPayment?.amountPaid ?? 0);
  }, 0);

  const tenantOverdueMap = new Map<string, {
    tenantId: string;
    tenant: { id: string; firstName: string; lastName: string };
    lease: (typeof activeRentLeases)[number];
    totalOwed: number;
  }>();

  for (const lease of activeRentLeases) {
    const owed = calculateLeaseOutstandingBalance({
      rentPayments: lease.rentPayments,
      transactions: lease.transactions,
    });
    if (owed <= 0) continue;
    const tenant = lease.tenants[0]?.tenant;
    if (!tenant) continue;
    const existing = tenantOverdueMap.get(tenant.id);
    if (existing) {
      existing.totalOwed += owed;
    } else {
      tenantOverdueMap.set(tenant.id, { tenantId: tenant.id, tenant, lease, totalOwed: owed });
    }
  }

  const overdueByTenant = Array.from(tenantOverdueMap.values()).sort((a, b) => b.totalOwed - a.totalOwed);
  const overdueTotal = overdueByTenant.reduce((sum, item) => sum + item.totalOwed, 0);
  const sortedMaintenance = [...openMaintenance].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
  );
  const signingOrder: Record<string, number> = { tenant_signed: 0, sent: 1, draft: 2 };
  const sortedPipeline = [...leasePipeline].sort(
    (a, b) => (signingOrder[a.signingStatus] ?? 99) - (signingOrder[b.signingStatus] ?? 99)
  );

  return {
    properties: {
      total: properties.length,
      occupied: properties.reduce((s, property) => s + property.units.filter((unit) => unit.status === "occupied").length, 0),
      vacant: properties.reduce((s, property) => s + property.units.filter((unit) => unit.status !== "occupied").length, 0),
    },
    rent: { totalExpected, totalCollected },
    expiringLeases,
    overdueByTenant,
    overdueCount: tenantOverdueMap.size,
    overdueTotal,
    pendingApps,
    vacancyCount,
    leasePipeline: sortedPipeline,
    openMaintenance: sortedMaintenance,
    unreadThreads,
    openTasks,
    overdueTasks,
    unpaidBills,
    unpaidBillsTotal: unpaidBills.reduce((s, b) => s + Number(b.amount), 0),
    overdueBillsCount: unpaidBills.filter((b) => b.status === "approved" && b.dueDate != null && new Date(b.dueDate) < new Date()).length,
  };
}

function EmptyQueue({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
      <CheckCircle2 className="h-4 w-4 text-primary" />
      {label}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const data = await getDashboardData(session.user.organizationId, session.user.id);

  const collectionPct = data.rent.totalExpected > 0
    ? Math.round((data.rent.totalCollected / data.rent.totalExpected) * 100)
    : 0;
  const attentionCount =
    data.overdueCount +
    data.pendingApps +
    data.vacancyCount +
    data.leasePipeline.length +
    data.openMaintenance.length +
    data.unreadThreads.length +
    data.expiringLeases.length +
    data.openTasks;

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="page-shell page-stack">
      <section className="office-header">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="page-kicker">Today's Office</p>
            <h1 className="page-title mt-2">Portfolio command center</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {dateLabel}. {attentionCount === 0
                ? "Everything important is quiet right now."
                : `${attentionCount} item${attentionCount === 1 ? "" : "s"} need attention across rent, leasing, tasks, maintenance, and messages.`}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[30rem]">
            <div className="rounded-md border bg-background/55 p-3">
              <p className="text-xs text-muted-foreground">Collected</p>
              <p className="mt-1 font-mono text-lg font-semibold">{formatCurrency(data.rent.totalCollected)}</p>
            </div>
            <div className="rounded-md border bg-background/55 p-3">
              <p className="text-xs text-muted-foreground">Collection</p>
              <p className="mt-1 font-mono text-lg font-semibold">{collectionPct}%</p>
            </div>
            <div className="rounded-md border bg-background/55 p-3">
              <p className="text-xs text-muted-foreground">Open items</p>
              <p className="mt-1 font-mono text-lg font-semibold">{attentionCount}</p>
            </div>
          </div>
        </div>
      </section>

      {data.properties.total === 0 && (
        <div className="surface-panel flex flex-col gap-4 p-4 md:flex-row md:items-center md:p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Migrating from another platform?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a ledger from Buildium, AppFolio, Cozy, Rentec, or a spreadsheet. AI prepares the setup for review.
            </p>
          </div>
          <Link href="/migration" className="quiet-link">
            Start migration <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="surface-panel flex flex-col gap-4 p-4 md:flex-row md:items-center md:p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Financial advisor</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Review operating risk, collections, rent opportunity, expenses, and portfolio priorities.
          </p>
        </div>
        <Link href="/portfolio-analyzer" className="quiet-link">
          Open advisor <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Properties</p>
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-4 font-mono text-3xl font-semibold">{data.properties.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.properties.occupied} occupied / {data.properties.vacant} vacant
          </p>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Rent this month</p>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-4 font-mono text-3xl font-semibold">{formatCurrency(data.rent.totalCollected)}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            {collectionPct}% of {formatCurrency(data.rent.totalExpected)}
          </p>
        </div>

        <Link href="/vacancy" className="metric-card block">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Vacancies</p>
            <DoorOpen className="h-4 w-4 text-primary" />
          </div>
          <p className={data.vacancyCount > 0 ? "mt-4 font-mono text-3xl font-semibold text-amber-700 dark:text-amber-300" : "mt-4 font-mono text-3xl font-semibold"}>
            {data.vacancyCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{data.vacancyCount === 0 ? "All units occupied" : "units available"}</p>
        </Link>

        <Link href="/applications" className="metric-card block">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Applications</p>
            <ClipboardList className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-4 font-mono text-3xl font-semibold">{data.pendingApps}</p>
          <p className="mt-1 text-xs text-muted-foreground">active review</p>
        </Link>

        <Link href="/tasks" className="metric-card block">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Tasks</p>
            <CheckSquare className="h-4 w-4 text-primary" />
          </div>
          <p className={`mt-4 font-mono text-3xl font-semibold ${data.overdueTasks > 0 ? "text-destructive" : ""}`}>
            {data.openTasks}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.openTasks === 0 ? "all clear" : data.overdueTasks > 0 ? `${data.overdueTasks} overdue` : "open"}
          </p>
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Balance Due
              {data.overdueCount > 0 && <Badge variant="destructive" className="ml-auto">{data.overdueCount}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.overdueByTenant.length === 0 ? (
              <EmptyQueue label="All tenant balances are current." />
            ) : (
              <>
                <div className="flex items-end justify-between gap-4 rounded-md bg-muted/35 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding balance</p>
                    <p className="mt-1 font-mono text-2xl font-semibold text-destructive">{formatCurrency(data.overdueTotal)}</p>
                  </div>
                  <Link href="/rent" className="quiet-link">Open rent <ArrowRight className="h-4 w-4" /></Link>
                </div>
                {data.overdueByTenant.slice(0, 4).map(({ tenant, lease, totalOwed }) => (
                  <div key={tenant.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/tenants/${tenant.id}`} className="font-medium hover:text-primary">
                        {tenant.firstName} {tenant.lastName}
                      </Link>
                      <Link href={`/leases/${lease.id}`} className="block truncate text-xs text-muted-foreground hover:text-primary">
                        {lease.unit.property.name} - Unit {lease.unit.unitNumber}
                      </Link>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold text-destructive">{formatCurrency(totalOwed)}</span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className={`h-4 w-4 ${data.openMaintenance.some((r) => r.priority === "emergency") ? "text-destructive" : "text-primary"}`} />
              Open Maintenance
              {data.openMaintenance.some((r) => r.priority === "emergency") && (
                <Badge variant="destructive" className="ml-1 text-xs">Emergency</Badge>
              )}
              {data.openMaintenance.length > 0 && <Badge variant="secondary" className="ml-auto">{data.openMaintenance.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.openMaintenance.length === 0 ? (
              <EmptyQueue label="No open maintenance requests." />
            ) : (
              data.openMaintenance.slice(0, 5).map((req) => (
                <div key={req.id} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/maintenance/${req.id}`} className="line-clamp-1 font-medium hover:text-primary">
                      {req.title}
                    </Link>
                    {req.unit && (
                      <p className="truncate text-xs text-muted-foreground">
                        {req.unit.property.name} - Unit {req.unit.unitNumber}
                      </p>
                    )}
                  </div>
                  <Badge className={`shrink-0 border text-xs ${PRIORITY_STYLES[req.priority] ?? ""}`}>
                    {req.priority}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Lease Pipeline
              {data.leasePipeline.length > 0 && <Badge variant="secondary" className="ml-auto">{data.leasePipeline.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.leasePipeline.length === 0 ? (
              <EmptyQueue label="No pending leases." />
            ) : (
              data.leasePipeline.slice(0, 5).map((lease) => {
                const tenant = lease.tenants.find((lt) => lt.isPrimary)?.tenant ?? lease.tenants[0]?.tenant;
                return (
                  <div key={lease.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/leases/${lease.id}`} className="font-medium hover:text-primary">
                        {tenant ? `${tenant.firstName} ${tenant.lastName}` : "No tenant"}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {lease.unit.property.name} - Unit {lease.unit.unitNumber}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs capitalize text-muted-foreground">
                      {lease.signingStatus.replace("_", " ")}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-primary" />
              Tenant Messages
              {data.unreadThreads.length > 0 && <Badge variant="destructive" className="ml-auto">{data.unreadThreads.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.unreadThreads.length === 0 ? (
              <EmptyQueue label="No unread messages." />
            ) : (
              data.unreadThreads.slice(0, 5).map((thread) => {
                const latest = thread.messages[0];
                return (
                  <div key={thread.id} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2.5">
                    <div className="min-w-0">
                      <Link href="/messages" className="line-clamp-1 font-medium hover:text-primary">
                        {thread.subject}
                      </Link>
                      {latest && <p className="line-clamp-1 text-xs text-muted-foreground">{latest.body}</p>}
                    </div>
                    {latest && <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(latest.createdAt)}</span>}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-primary" />
              Bills & Payables
              {data.unpaidBills.length > 0 && (
                <Badge variant={data.overdueBillsCount > 0 ? "destructive" : "secondary"} className="ml-auto">
                  {data.unpaidBills.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.unpaidBills.length === 0 ? (
              <EmptyQueue label="No outstanding bills." />
            ) : (
              <>
                <div className="flex items-end justify-between gap-4 rounded-md bg-muted/35 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total unpaid</p>
                    <p className="mt-1 font-mono text-2xl font-semibold">{formatCurrency(data.unpaidBillsTotal)}</p>
                  </div>
                  <Link href="/bills" className="quiet-link">Open bills <ArrowRight className="h-4 w-4" /></Link>
                </div>
                {data.unpaidBills.slice(0, 4).map((b) => {
                  const overdue = b.status === "approved" && b.dueDate != null && new Date(b.dueDate) < new Date();
                  const label = b.vendor?.name ?? b.vendorName ?? "Unknown";
                  return (
                    <div key={b.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="font-medium">{label}</p>
                        {b.property && <p className="truncate text-xs text-muted-foreground">{b.property.name}</p>}
                        {b.dueDate && (
                          <p className={`text-xs ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                            {overdue ? "Overdue · " : "Due "}
                            {new Date(b.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-sm font-semibold">{formatCurrency(Number(b.amount))}</span>
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {data.expiringLeases.length > 0 && (
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" />
              Leases Expiring Soon
              <Badge variant="secondary" className="ml-auto">{data.expiringLeases.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.expiringLeases.map((lease) => {
                const tenant = lease.tenants[0]?.tenant;
                const days = daysUntil(lease.endDate);
                return (
                  <div key={lease.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                    <div className="min-w-0">
                      {tenant ? (
                        <Link href={`/tenants/${tenant.id}`} className="font-medium hover:text-primary">
                          {tenant.firstName} {tenant.lastName}
                        </Link>
                      ) : (
                        <p className="font-medium">Unknown tenant</p>
                      )}
                      <p className="truncate text-xs text-muted-foreground">
                        {lease.unit.property.name} - Unit {lease.unit.unitNumber}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={days !== null && days <= 30 ? "destructive" : "secondary"} className="text-xs">
                        {days}d
                      </Badge>
                      <Link href={`/renewals/${lease.id}`} className="quiet-link text-xs">
                        Renew
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
