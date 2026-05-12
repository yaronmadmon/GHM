import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { formatCurrency, formatRelativeTime, daysUntil } from "@/lib/utils";
import { calculateLeaseOutstandingBalance } from "@/lib/rent-ledger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  DollarSign,
  AlertTriangle,
  Clock,
  Wrench,
  ClipboardList,
  TrendingUp,
  Sparkles,
  Brain,
  ArrowRight,
  DoorOpen,
  FileText,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";

const PRIORITY_ORDER: Record<string, number> = { emergency: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_STYLES: Record<string, string> = {
  emergency: "bg-red-500/10 text-red-600 border-red-200",
  high: "bg-orange-500/10 text-orange-600 border-orange-200",
  medium: "bg-amber-500/10 text-amber-700 border-amber-200",
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
    prisma.application.count({ where: { organizationId, status: { in: ["pending", "documents_requested", "under_review", "screening"] } } }),
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
  const overdueByTenant = Array.from(tenantOverdueMap.values())
    .sort((a, b) => b.totalOwed - a.totalOwed);
  const overdueTotal = overdueByTenant.reduce((sum, item) => sum + item.totalOwed, 0);

  const sortedMaintenance = [...openMaintenance].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
  );

  // Sort lease pipeline: tenant_signed first, then sent, then draft
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
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const data = await getDashboardData(session.user.organizationId, session.user.id);

  const collectionPct = data.rent.totalExpected > 0
    ? Math.round((data.rent.totalCollected / data.rent.totalExpected) * 100)
    : 0;
  const visibleOverdue = data.overdueByTenant.slice(0, 2);
  const hiddenOverdue = data.overdueByTenant.slice(2);
  const visiblePipeline = data.leasePipeline.slice(0, 3);
  const hiddenPipeline = data.leasePipeline.slice(3);
  const visibleMaintenance = data.openMaintenance.slice(0, 3);
  const hiddenMaintenance = data.openMaintenance.slice(3);
  const visibleThreads = data.unreadThreads.slice(0, 3);
  const hiddenThreads = data.unreadThreads.slice(3);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Migration CTA */}
      {data.properties.total === 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-5 py-5">
            <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Migrating from another platform?</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Upload a tenant ledger from Buildium, AppFolio, Cozy, Rentec, or any spreadsheet — AI sets everything up automatically.
              </p>
            </div>
            <Link href="/migration" className="flex-shrink-0">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline whitespace-nowrap">
                Start migration <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-card">
        <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">Open the financial advisor</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Review financial health, risk, rent opportunity, expenses, collections, and operating priorities.
            </p>
          </div>
          <Link href="/portfolio-analyzer" className="shrink-0">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              Open advisor <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid auto-rows-fr grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="h-32">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.properties.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.properties.occupied} occupied units · {data.properties.vacant} vacant
            </p>
          </CardContent>
        </Card>

        <Card className="h-32">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Rent this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(data.rent.totalCollected)}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {collectionPct}% of {formatCurrency(data.rent.totalExpected)} expected
            </p>
          </CardContent>
        </Card>

        <Link href="/vacancy" className="h-full">
          <Card className="h-32 hover:border-primary/40 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DoorOpen className="h-4 w-4" /> Vacancies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${data.vacancyCount > 0 ? "text-amber-600" : ""}`}>
                {data.vacancyCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.vacancyCount === 0 ? "All units occupied" : "vacant units"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/applications" className="h-full">
          <Card className="h-32 hover:border-primary/40 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{data.pendingApps}</div>
              <p className="text-xs text-muted-foreground mt-1">in progress</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid auto-rows-fr grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Overdue Payments */}
        <Card className="h-32 overflow-visible">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Balance Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.overdueByTenant.length === 0 ? (
              <>
                <div className="text-3xl font-bold text-muted-foreground">{formatCurrency(0)}</div>
                <p className="text-xs text-muted-foreground mt-1">All payments are current.</p>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-destructive">{formatCurrency(data.overdueTotal)}</div>
                {false && visibleOverdue.map(({ tenant, lease, totalOwed }) => (
                  <div key={tenant.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <Link href={`/tenants/${tenant.id}`} className="font-medium hover:text-primary transition-colors">
                        {tenant.firstName} {tenant.lastName}
                      </Link>
                      <Link href={`/leases/${lease.id}`} className="text-muted-foreground text-xs hover:text-primary transition-colors block truncate">
                        {lease.unit.property.name} · Unit {lease.unit.unitNumber}
                      </Link>
                    </div>
                    <span className="text-destructive font-semibold shrink-0">{formatCurrency(totalOwed)}</span>
                  </div>
                ))}
                {false && hiddenOverdue.length > 0 && (
                  <details className="rounded-lg border px-3 py-2 text-sm">
                    <summary className="cursor-pointer text-xs font-medium text-primary">
                      Show {hiddenOverdue.length} more
                    </summary>
                    <div className="mt-3 space-y-3">
                      {hiddenOverdue.map(({ tenant, lease, totalOwed }) => (
                        <div key={tenant.id} className="flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <Link href={`/tenants/${tenant.id}`} className="font-medium hover:text-primary transition-colors">
                              {tenant.firstName} {tenant.lastName}
                            </Link>
                            <Link href={`/leases/${lease.id}`} className="text-muted-foreground text-xs hover:text-primary transition-colors block truncate">
                              {lease.unit.property.name} · Unit {lease.unit.unitNumber}
                            </Link>
                          </div>
                          <span className="text-destructive font-semibold shrink-0">{formatCurrency(totalOwed)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {data.overdueCount} tenant{data.overdueCount === 1 ? "" : "s"} with a balance
                  </p>
                  <details className="group relative">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary hover:underline">
                      Details <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
                      <div className="mb-2 flex items-center justify-between border-b pb-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Outstanding balances</p>
                        <p className="text-xs font-semibold text-destructive">{formatCurrency(data.overdueTotal)}</p>
                      </div>
                      <div className="max-h-80 space-y-3 overflow-y-auto">
                        {data.overdueByTenant.map(({ tenant, lease, totalOwed }) => (
                          <div key={tenant.id} className="flex items-center justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <Link href={`/tenants/${tenant.id}`} className="font-medium hover:text-primary transition-colors">
                                {tenant.firstName} {tenant.lastName}
                              </Link>
                              <Link href={`/leases/${lease.id}`} className="text-muted-foreground text-xs hover:text-primary transition-colors block truncate">
                                {lease.unit.property.name} · Unit {lease.unit.unitNumber}
                              </Link>
                            </div>
                            <span className="text-destructive font-semibold shrink-0">{formatCurrency(totalOwed)}</span>
                          </div>
                        ))}
                      </div>
                      <Link href="/rent" className="mt-3 block border-t pt-2 text-xs font-medium text-primary hover:underline">
                        View rent ledger →
                      </Link>
                    </div>
                  </details>
                </div>
              </>
            )}
            {false && data.overdueCount > 0 && (
              <Link href="/rent" className="text-xs text-primary hover:underline block mt-2">View all →</Link>
            )}
          </CardContent>
        </Card>

        {/* Lease Pipeline */}
        <Card className="h-32 overflow-visible">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Lease Pipeline
              {false && data.leasePipeline.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{data.leasePipeline.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.leasePipeline.length === 0 ? (
              <>
                <div className="text-3xl font-bold">0</div>
                <p className="text-xs text-muted-foreground mt-1">No pending leases.</p>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold">{data.leasePipeline.length}</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">leases need action</p>
                  <details className="group relative">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary hover:underline">
                      Details <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
                      <div className="mb-2 border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Lease pipeline</div>
                      <div className="max-h-80 space-y-3 overflow-y-auto">
                        {data.leasePipeline.map((lease) => {
                          const tenant = lease.tenants.find((lt) => lt.isPrimary)?.tenant ?? lease.tenants[0]?.tenant;
                          return (
                            <div key={lease.id} className="flex items-center justify-between gap-3 text-sm">
                              <div className="min-w-0">
                                <Link href={`/leases/${lease.id}`} className="font-medium hover:text-primary transition-colors">
                                  {tenant ? `${tenant.firstName} ${tenant.lastName}` : "—"}
                                </Link>
                                <p className="text-muted-foreground text-xs truncate">
                                  {lease.unit.property.name} · Unit {lease.unit.unitNumber}
                                </p>
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0 capitalize">{lease.signingStatus.replace("_", " ")}</span>
                            </div>
                          );
                        })}
                      </div>
                      <Link href="/leases" className="mt-3 block border-t pt-2 text-xs font-medium text-primary hover:underline">
                        View leases →
                      </Link>
                    </div>
                  </details>
                </div>
                {false && visiblePipeline.map((lease) => {
                const tenant = lease.tenants.find((lt) => lt.isPrimary)?.tenant ?? lease.tenants[0]?.tenant;
                return (
                  <div key={lease.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <Link href={`/leases/${lease.id}`} className="font-medium hover:text-primary transition-colors">
                        {tenant ? `${tenant.firstName} ${tenant.lastName}` : "—"}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {lease.unit.property.name} · Unit {lease.unit.unitNumber}
                      </p>
                    </div>
                    {lease.signingStatus === "tenant_signed" && (
                      <span className="text-xs font-medium text-amber-600 shrink-0 ml-2">Needs your signature</span>
                    )}
                    {lease.signingStatus === "sent" && (
                      <span className="text-xs text-blue-500 shrink-0 ml-2">Awaiting tenant</span>
                    )}
                    {lease.signingStatus === "draft" && (
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">Not sent</span>
                    )}
                  </div>
                );
              })}
              </>
            )}
            {false && data.leasePipeline.length > 0 && (
              <Link href="/leases" className="text-xs text-primary hover:underline block mt-2">View all →</Link>
            )}
          </CardContent>
        </Card>

        {/* Open Maintenance */}
        <Card className="h-32 overflow-visible">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4 text-orange-500" />
              Open Maintenance
              {false && data.openMaintenance.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{data.openMaintenance.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.openMaintenance.length === 0 ? (
              <>
                <div className="text-3xl font-bold">0</div>
                <p className="text-xs text-muted-foreground mt-1">No open maintenance requests.</p>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold">{data.openMaintenance.length}</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">open requests</p>
                  <details className="group relative">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary hover:underline">
                      Details <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
                      <div className="mb-2 border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Open maintenance</div>
                      <div className="max-h-80 space-y-3 overflow-y-auto">
                        {data.openMaintenance.map((req) => (
                          <div key={req.id} className="flex items-start justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <Link href={`/maintenance/${req.id}`} className="font-medium hover:text-primary transition-colors line-clamp-1">
                                {req.title}
                              </Link>
                              {req.unit && (
                                <p className="text-muted-foreground text-xs truncate">
                                  {req.unit.property.name} · Unit {req.unit.unitNumber}
                                </p>
                              )}
                            </div>
                            <Badge className={`text-xs border shrink-0 ${PRIORITY_STYLES[req.priority] ?? ""}`}>
                              {req.priority}
                            </Badge>
                          </div>
                        ))}
                      </div>
                      <Link href="/maintenance" className="mt-3 block border-t pt-2 text-xs font-medium text-primary hover:underline">
                        View maintenance →
                      </Link>
                    </div>
                  </details>
                </div>
                {false && visibleMaintenance.map((req) => (
                <div key={req.id} className="flex items-start justify-between text-sm gap-2">
                  <div className="min-w-0">
                    <Link href={`/maintenance/${req.id}`} className="font-medium hover:text-primary transition-colors line-clamp-1">
                      {req.title}
                    </Link>
                    {req.unit && (
                      <p className="text-muted-foreground text-xs">
                        {req.unit.property.name} · Unit {req.unit.unitNumber}
                      </p>
                    )}
                  </div>
                  <Badge className={`text-xs border shrink-0 ${PRIORITY_STYLES[req.priority] ?? ""}`}>
                    {req.priority}
                  </Badge>
                </div>
              ))}
              </>
            )}
            {false && data.openMaintenance.length > 0 && (
              <Link href="/maintenance" className="text-xs text-primary hover:underline block mt-2">View all →</Link>
            )}
          </CardContent>
        </Card>

        {/* Tenant Messages */}
        <Card className="h-32 overflow-visible">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Tenant Messages
              {false && data.unreadThreads.length > 0 && (
                <Badge variant="destructive" className="ml-auto">{data.unreadThreads.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.unreadThreads.length === 0 ? (
              <>
                <div className="text-3xl font-bold">0</div>
                <p className="text-xs text-muted-foreground mt-1">No unread messages.</p>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-destructive">{data.unreadThreads.length}</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">unread messages</p>
                  <details className="group relative">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary hover:underline">
                      Details <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
                      <div className="mb-2 border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Unread messages</div>
                      <div className="max-h-80 space-y-3 overflow-y-auto">
                        {data.unreadThreads.map((thread) => {
                          const latest = thread.messages[0];
                          return (
                            <div key={thread.id} className="flex items-start justify-between gap-3 text-sm">
                              <div className="min-w-0">
                                <Link href="/messages" className="font-medium hover:text-primary transition-colors line-clamp-1">
                                  {thread.subject}
                                </Link>
                                {latest && <p className="text-muted-foreground text-xs line-clamp-1">{latest.body}</p>}
                              </div>
                              {latest && <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(latest.createdAt)}</span>}
                            </div>
                          );
                        })}
                      </div>
                      <Link href="/messages" className="mt-3 block border-t pt-2 text-xs font-medium text-primary hover:underline">
                        View messages →
                      </Link>
                    </div>
                  </details>
                </div>
                {false && visibleThreads.map((thread) => {
                const latest = thread.messages[0];
                return (
                  <div key={thread.id} className="flex items-start justify-between text-sm gap-2">
                    <div className="min-w-0">
                      <Link href={`/messages`} className="font-medium hover:text-primary transition-colors line-clamp-1">
                        {thread.subject}
                      </Link>
                      {latest && (
                        <p className="text-muted-foreground text-xs line-clamp-1">{latest.body}</p>
                      )}
                    </div>
                    {latest && (
                      <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(latest.createdAt)}</span>
                    )}
                  </div>
                );
              })}
              </>
            )}
            {false && data.unreadThreads.length > 0 && (
              <Link href="/messages" className="text-xs text-primary hover:underline block mt-2">View all →</Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expiring Leases */}
      {data.expiringLeases.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Leases Expiring Soon
              <Badge variant="secondary" className="ml-auto">{data.expiringLeases.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.expiringLeases.map((l) => {
                const tenant = l.tenants[0]?.tenant;
                const days = daysUntil(l.endDate);
                return (
                  <div key={l.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                    <div>
                      {tenant ? (
                        <Link href={`/tenants/${tenant.id}`} className="font-medium hover:text-primary transition-colors">
                          {tenant.firstName} {tenant.lastName}
                        </Link>
                      ) : (
                        <p className="font-medium">Unknown Tenant</p>
                      )}
                      <p className="text-muted-foreground text-xs">{l.unit.property.name} · Unit {l.unit.unitNumber}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={days !== null && days <= 30 ? "destructive" : "secondary"} className="text-xs">
                        {days}d
                      </Badge>
                      <Link href={`/renewals/${l.id}`} className="text-xs text-primary hover:underline">Renew →</Link>
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
