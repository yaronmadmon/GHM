import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { formatCurrency, formatRelativeTime, daysUntil } from "@/lib/utils";
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
    overduePayments,
    pendingApps,
    monthPayments,
    vacancyCount,
    leasePipeline,
    openMaintenance,
    unreadThreads,
  ] = await Promise.all([
    prisma.property.groupBy({ by: ["status"], where: { organizationId, archivedAt: null }, _count: true }),
    prisma.lease.findMany({
      where: { organizationId, status: "active", endDate: { gte: now, lte: addDays(now, 60) } },
      include: { unit: { include: { property: true } }, tenants: { include: { tenant: true } } },
      orderBy: { endDate: "asc" },
      take: 5,
    }),
    prisma.rentPayment.findMany({
      where: { organizationId, status: "overdue" },
      include: { lease: { include: { unit: { include: { property: true } }, tenants: { include: { tenant: true } } } } },
    }),
    prisma.application.count({ where: { organizationId, status: { in: ["pending", "documents_requested", "under_review", "screening"] } } }),
    prisma.rentPayment.findMany({ where: { organizationId, periodYear: year, periodMonth: month } }),
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

  const totalExpected = monthPayments.reduce((s, p) => s + Number(p.amountDue), 0);
  const totalCollected = monthPayments.reduce((s, p) => s + Number(p.amountPaid), 0);

  const tenantOverdueMap = new Map<string, {
    tenantId: string;
    tenant: { id: string; firstName: string; lastName: string };
    lease: typeof overduePayments[0]["lease"];
    totalOwed: number;
  }>();
  for (const p of overduePayments) {
    const owed = Number(p.amountDue) - Number(p.amountPaid);
    if (owed <= 0) continue;
    const tenant = p.lease.tenants[0]?.tenant;
    if (!tenant) continue;
    const existing = tenantOverdueMap.get(tenant.id);
    if (existing) {
      existing.totalOwed += owed;
    } else {
      tenantOverdueMap.set(tenant.id, { tenantId: tenant.id, tenant, lease: p.lease, totalOwed: owed });
    }
  }
  const overdueByTenant = Array.from(tenantOverdueMap.values())
    .sort((a, b) => b.totalOwed - a.totalOwed)
    .slice(0, 5);

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
      total: properties.reduce((s, g) => s + g._count, 0),
      occupied: properties.find((g) => g.status === "occupied")?._count ?? 0,
      vacant: properties.find((g) => g.status === "vacant")?._count ?? 0,
    },
    rent: { totalExpected, totalCollected },
    expiringLeases,
    overdueByTenant,
    overdueCount: tenantOverdueMap.size,
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
            <p className="font-semibold text-sm">Run a portfolio analysis</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Let AI review vacancies, rent opportunity, expenses, collections, renewals, and maintenance risk.
            </p>
          </div>
          <Link href="/portfolio-analyzer" className="shrink-0">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              Activate analyzer <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.properties.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.properties.occupied} occupied · {data.properties.vacant} vacant
            </p>
          </CardContent>
        </Card>

        <Card>
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

        <Link href="/vacancy">
          <Card className="hover:border-primary/40 transition-colors cursor-pointer">
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

        <Link href="/applications">
          <Card className="hover:border-primary/40 transition-colors cursor-pointer">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Payments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Overdue Rent
              {data.overdueCount > 0 && (
                <Badge variant="destructive" className="ml-auto">{data.overdueCount}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.overdueByTenant.length === 0 ? (
              <p className="text-sm text-muted-foreground">All payments are current.</p>
            ) : (
              data.overdueByTenant.map(({ tenant, lease, totalOwed }) => (
                <div key={tenant.id} className="flex items-center justify-between text-sm">
                  <div>
                    <Link href={`/tenants/${tenant.id}`} className="font-medium hover:text-primary transition-colors">
                      {tenant.firstName} {tenant.lastName}
                    </Link>
                    <Link href={`/leases/${lease.id}`} className="text-muted-foreground text-xs hover:text-primary transition-colors block">
                      {lease.unit.property.name} · Unit {lease.unit.unitNumber}
                    </Link>
                  </div>
                  <span className="text-destructive font-semibold">{formatCurrency(totalOwed)}</span>
                </div>
              ))
            )}
            {data.overdueCount > 0 && (
              <Link href="/rent" className="text-xs text-primary hover:underline block mt-2">View all →</Link>
            )}
          </CardContent>
        </Card>

        {/* Lease Pipeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Lease Pipeline
              {data.leasePipeline.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{data.leasePipeline.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.leasePipeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending leases.</p>
            ) : (
              data.leasePipeline.map((lease) => {
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
              })
            )}
            {data.leasePipeline.length > 0 && (
              <Link href="/leases" className="text-xs text-primary hover:underline block mt-2">View all →</Link>
            )}
          </CardContent>
        </Card>

        {/* Open Maintenance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4 text-orange-500" />
              Open Maintenance
              {data.openMaintenance.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{data.openMaintenance.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.openMaintenance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open maintenance requests.</p>
            ) : (
              data.openMaintenance.map((req) => (
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
              ))
            )}
            {data.openMaintenance.length > 0 && (
              <Link href="/maintenance" className="text-xs text-primary hover:underline block mt-2">View all →</Link>
            )}
          </CardContent>
        </Card>

        {/* Tenant Messages */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Tenant Messages
              {data.unreadThreads.length > 0 && (
                <Badge variant="destructive" className="ml-auto">{data.unreadThreads.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.unreadThreads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unread messages.</p>
            ) : (
              data.unreadThreads.map((thread) => {
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
              })
            )}
            {data.unreadThreads.length > 0 && (
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
