import { auth } from "@/lib/auth";
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
} from "lucide-react";
import Link from "next/link";

async function getDashboardData(organizationId: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [properties, expiringLeases, overduePayments, openMaintenance, pendingApps, monthPayments, recentActivity] = await Promise.all([
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
      orderBy: { amountDue: "desc" },
      take: 5,
    }),
    prisma.maintenanceRequest.groupBy({ by: ["priority"], where: { organizationId, status: { in: ["open", "in_progress"] } }, _count: true }),
    prisma.application.count({ where: { organizationId, status: "pending" } }),
    prisma.rentPayment.findMany({ where: { organizationId, periodYear: year, periodMonth: month } }),
    prisma.activityEvent.findMany({
      where: { organizationId },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const totalExpected = monthPayments.reduce((s, p) => s + Number(p.amountDue), 0);
  const totalCollected = monthPayments.reduce((s, p) => s + Number(p.amountPaid), 0);

  return {
    properties: {
      total: properties.reduce((s, g) => s + g._count, 0),
      occupied: properties.find((g) => g.status === "occupied")?._count ?? 0,
      vacant: properties.find((g) => g.status === "vacant")?._count ?? 0,
    },
    rent: { totalExpected, totalCollected },
    expiringLeases,
    overduePayments,
    maintenance: openMaintenance.reduce((a, g) => ({ ...a, [g.priority]: g._count }), {} as Record<string, number>),
    pendingApps,
    recentActivity,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const data = await getDashboardData(session.user.organizationId);

  const totalOpen = Object.values(data.maintenance).reduce((s: number, n: unknown) => s + (n as number), 0);
  const collectionPct = data.rent.totalExpected > 0
    ? Math.round((data.rent.totalCollected / data.rent.totalExpected) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wrench className="h-4 w-4" /> Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalOpen}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.maintenance.emergency ?? 0} emergency · {data.maintenance.high ?? 0} high
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.pendingApps}</div>
            <p className="text-xs text-muted-foreground mt-1">pending review</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overdue Payments */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Overdue Rent
              {data.overduePayments.length > 0 && (
                <Badge variant="destructive" className="ml-auto">{data.overduePayments.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.overduePayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">All payments are current.</p>
            ) : (
              data.overduePayments.map((p) => {
                const tenant = p.lease.tenants[0]?.tenant;
                const owed = Number(p.amountDue) - Number(p.amountPaid);
                return (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{tenant?.firstName} {tenant?.lastName}</p>
                      <p className="text-muted-foreground text-xs">{p.lease.unit.property.name}</p>
                    </div>
                    <span className="text-destructive font-semibold">{formatCurrency(owed)}</span>
                  </div>
                );
              })
            )}
            {data.overduePayments.length > 0 && (
              <Link href="/rent" className="text-xs text-primary hover:underline block mt-2">View all →</Link>
            )}
          </CardContent>
        </Card>

        {/* Expiring Leases */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Expiring Leases
              {data.expiringLeases.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{data.expiringLeases.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.expiringLeases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leases expiring soon.</p>
            ) : (
              data.expiringLeases.map((l) => {
                const tenant = l.tenants[0]?.tenant;
                const days = daysUntil(l.endDate);
                return (
                  <div key={l.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{tenant?.firstName} {tenant?.lastName}</p>
                      <p className="text-muted-foreground text-xs">{l.unit.property.name} · Unit {l.unit.unitNumber}</p>
                    </div>
                    <Badge variant={days && days <= 30 ? "destructive" : "secondary"} className="text-xs">
                      {days}d
                    </Badge>
                  </div>
                );
              })
            )}
            {data.expiringLeases.length > 0 && (
              <Link href="/leases" className="text-xs text-primary hover:underline block mt-2">View all →</Link>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            ) : (
              data.recentActivity.map((e) => (
                <div key={e.id} className="text-sm">
                  <p className="text-foreground/80">
                    <span className="font-medium">{e.actor?.name ?? "System"}</span>
                    {" "}{formatEventType(e.eventType, e.entityType)}
                    {" "}<span className="text-muted-foreground">{getEntityLabel(e)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(e.createdAt)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatEventType(eventType: string, entityType: string) {
  const map: Record<string, string> = {
    "created": `added a ${entityType}`,
    "updated": `updated a ${entityType}`,
    "status_changed": `changed ${entityType} status`,
    "payment_recorded": "recorded a payment",
  };
  return map[eventType] ?? eventType;
}

function getEntityLabel(e: { metadata: unknown; entityType: string }) {
  if (!e.metadata || typeof e.metadata !== "object") return "";
  const m = e.metadata as Record<string, string>;
  return m.name ?? m.title ?? m.applicantName ?? "";
}
