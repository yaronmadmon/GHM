import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { calculateLeaseOutstandingBalance } from "@/lib/rent-ledger";
import { formatCurrency, formatDate, formatRelativeTime, daysUntil } from "@/lib/utils";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckSquare,
  Clock,
  DollarSign,
  FileText,
  MessageSquare,
  Receipt,
  Wrench,
} from "lucide-react";

function EmptyCard({ label }: { label: string }) {
  return (
    <p className="py-3 text-sm text-muted-foreground">{label}</p>
  );
}

function SectionCard({
  title,
  icon,
  count,
  urgent,
  href,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  urgent?: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={urgent && count > 0 ? "border-destructive/30" : ""}>
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
          {count > 0 && (
            <Badge variant={urgent ? "destructive" : "secondary"} className="ml-auto">
              {count}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-3">
        {children}
        {count > 0 && (
          <Link
            href={href}
            className="mt-1 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default async function TodaysOfficePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const orgId = session.user.organizationId;
  const now = new Date();
  const in7Days = addDays(now, 7);
  const in60Days = addDays(now, 60);

  const [
    activeLeases,
    pendingPaymentReqs,
    urgentBills,
    maintenanceItems,
    expiringLeases,
    pendingApps,
    unreadThreads,
    dueTasks,
    needsReviewDocs,
  ] = await Promise.all([
    prisma.lease.findMany({
      where: { organizationId: orgId, status: "active" },
      include: {
        rentPayments: true,
        transactions: true,
        unit: { include: { property: true } },
        tenants: { include: { tenant: true }, orderBy: [{ isPrimary: "desc" }], take: 1 },
      },
    }),
    prisma.paymentRequest.findMany({
      where: { organizationId: orgId, status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.bill.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["needs_review", "approved"] },
      },
      include: { vendor: { select: { name: true } }, property: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
    prisma.maintenanceRequest.findMany({
      where: { organizationId: orgId, status: { in: ["open", "in_progress", "pending_parts"] } },
      include: { unit: { include: { property: true } }, assignedVendor: { select: { name: true } } },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      take: 6,
    }),
    prisma.lease.findMany({
      where: { organizationId: orgId, status: "active", endDate: { gte: now, lte: in60Days } },
      include: {
        unit: { include: { property: true } },
        tenants: { include: { tenant: true }, orderBy: [{ isPrimary: "desc" }], take: 1 },
      },
      orderBy: { endDate: "asc" },
      take: 6,
    }),
    prisma.application.findMany({
      where: { organizationId: orgId, status: { in: ["pending", "documents_requested", "under_review", "screening"] } },
      include: { property: { select: { name: true } }, unit: { select: { unitNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.messageThread.findMany({
      where: {
        organizationId: orgId,
        landlordUserId: session.user.id,
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
    prisma.task.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["open", "in_progress", "waiting"] },
        dueDate: { lte: in7Days },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 6,
    }),
    prisma.propertyDocument.findMany({
      where: {
        organizationId: orgId,
        OR: [{ confidenceScore: { lt: 0.6 } }, { confidenceScore: null }],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // Compute balances and filter to tenants who owe money
  const overdueTenants = activeLeases
    .map((lease) => {
      const balance = calculateLeaseOutstandingBalance({
        rentPayments: lease.rentPayments,
        transactions: lease.transactions,
      });
      const tenant = lease.tenants[0]?.tenant;
      return { lease, tenant, balance };
    })
    .filter((row) => row.balance > 0 && row.tenant)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 6);

  const overdueTotal = overdueTenants.reduce((s, r) => s + r.balance, 0);

  const overdueBills = urgentBills.filter(
    (b) => b.status === "approved" && b.dueDate != null && new Date(b.dueDate) < now,
  );
  const dueSoonBills = urgentBills.filter(
    (b) =>
      !(b.status === "approved" && b.dueDate != null && new Date(b.dueDate) < now) &&
      b.dueDate != null &&
      new Date(b.dueDate) <= in7Days,
  );
  const needsReviewBills = urgentBills.filter((b) => b.status === "needs_review");

  const emergencyMaint = maintenanceItems.filter((r) => r.priority === "emergency");
  const normalMaint = maintenanceItems.filter((r) => r.priority !== "emergency");

  const totalAttention =
    overdueTenants.length +
    pendingPaymentReqs.length +
    urgentBills.length +
    emergencyMaint.length +
    expiringLeases.length +
    pendingApps.length +
    unreadThreads.length +
    dueTasks.length;

  const PRIORITY_COLORS: Record<string, string> = {
    emergency: "text-red-600 dark:text-red-400",
    high: "text-orange-600 dark:text-orange-400",
    medium: "text-amber-600 dark:text-amber-400",
    low: "text-muted-foreground",
  };

  return (
    <div className="page-shell page-stack">
      <section className="office-header">
        <div>
          <p className="page-kicker">Command center</p>
          <h1 className="page-title mt-2">Today&apos;s Office</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.{" "}
            {totalAttention === 0
              ? "Everything is quiet — no items need attention."
              : `${totalAttention} item${totalAttention === 1 ? "" : "s"} need your attention.`}
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

        {/* Outstanding Balances */}
        <SectionCard
          title="Outstanding Balances"
          icon={<DollarSign className="h-4 w-4 text-destructive" />}
          count={overdueTenants.length}
          urgent={overdueTenants.length > 0}
          href="/rent"
        >
          {overdueTenants.length === 0 ? (
            <EmptyCard label="All tenant balances are current." />
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Total outstanding: <span className="font-semibold text-destructive">{formatCurrency(overdueTotal)}</span>
              </p>
              {overdueTenants.map(({ lease, tenant, balance }) => (
                <Link
                  key={lease.id}
                  href={`/tenants/${tenant!.id}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{tenant!.firstName} {tenant!.lastName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lease.unit.property.name} · Unit {lease.unit.unitNumber}
                    </p>
                  </div>
                  <span className="ml-2 shrink-0 font-mono text-sm font-semibold text-destructive">
                    {formatCurrency(balance)}
                  </span>
                </Link>
              ))}
            </>
          )}
        </SectionCard>

        {/* Bills */}
        <SectionCard
          title="Bills & Payables"
          icon={<Receipt className="h-4 w-4 text-primary" />}
          count={urgentBills.length}
          urgent={overdueBills.length > 0}
          href="/bills"
        >
          {urgentBills.length === 0 ? (
            <EmptyCard label="No outstanding bills." />
          ) : (
            <>
              {overdueBills.length > 0 && (
                <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                  <AlertTriangle className="h-3 w-3" /> {overdueBills.length} overdue
                </p>
              )}
              {[...overdueBills, ...dueSoonBills, ...needsReviewBills].slice(0, 5).map((b) => {
                const overdue = b.status === "approved" && b.dueDate != null && new Date(b.dueDate) < now;
                const label = b.vendor?.name ?? b.vendorName ?? "Unknown vendor";
                return (
                  <Link
                    key={b.id}
                    href="/bills"
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:border-primary/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.status === "needs_review" ? "Needs review" : overdue ? "Overdue" : b.dueDate ? `Due ${formatDate(new Date(b.dueDate))}` : "No due date"}
                      </p>
                    </div>
                    <span className="ml-2 shrink-0 font-mono text-sm font-semibold">
                      {formatCurrency(Number(b.amount))}
                    </span>
                  </Link>
                );
              })}
            </>
          )}
        </SectionCard>

        {/* Maintenance */}
        <SectionCard
          title="Maintenance"
          icon={<Wrench className="h-4 w-4 text-orange-500" />}
          count={maintenanceItems.length}
          urgent={emergencyMaint.length > 0}
          href="/maintenance"
        >
          {maintenanceItems.length === 0 ? (
            <EmptyCard label="No open maintenance requests." />
          ) : (
            <>
              {emergencyMaint.length > 0 && (
                <p className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-3 w-3" /> {emergencyMaint.length} emergency
                </p>
              )}
              {[...emergencyMaint, ...normalMaint].slice(0, 5).map((req) => (
                <Link
                  key={req.id}
                  href={`/maintenance/${req.id}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{req.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {req.unit?.property.name} · Unit {req.unit?.unitNumber}
                    </p>
                  </div>
                  <span className={`ml-2 shrink-0 text-xs font-semibold capitalize ${PRIORITY_COLORS[req.priority] ?? ""}`}>
                    {req.priority}
                  </span>
                </Link>
              ))}
            </>
          )}
        </SectionCard>

        {/* Tasks Due */}
        <SectionCard
          title="Tasks Due Soon"
          icon={<CheckSquare className="h-4 w-4 text-primary" />}
          count={dueTasks.length}
          urgent={dueTasks.some((t) => t.dueDate != null && new Date(t.dueDate) < now)}
          href="/tasks"
        >
          {dueTasks.length === 0 ? (
            <EmptyCard label="No tasks due in the next 7 days." />
          ) : (
            dueTasks.map((task) => {
              const overdue = task.dueDate != null && new Date(task.dueDate) < now;
              return (
                <Link
                  key={task.id}
                  href="/tasks"
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{task.title}</p>
                    {task.dueDate && (
                      <p className={`text-xs ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                        {overdue ? "Overdue · " : "Due "}{formatDate(task.dueDate)}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={`ml-2 shrink-0 text-xs ${task.priority === "urgent" ? "border-red-200 text-red-600" : task.priority === "high" ? "border-orange-200 text-orange-600" : ""}`}
                  >
                    {task.priority}
                  </Badge>
                </Link>
              );
            })
          )}
        </SectionCard>

        {/* Payment Requests */}
        <SectionCard
          title="Payment Requests"
          icon={<Bell className="h-4 w-4 text-primary" />}
          count={pendingPaymentReqs.length}
          href="/rent"
        >
          {pendingPaymentReqs.length === 0 ? (
            <EmptyCard label="No pending payment requests." />
          ) : (
            pendingPaymentReqs.map((pr) => (
              <Link
                key={pr.id}
                href="/rent"
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:border-primary/40"
              >
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {formatDate(pr.createdAt)} · {pr.method}
                  </p>
                </div>
                <span className="ml-2 shrink-0 font-mono text-sm font-semibold">
                  {formatCurrency(Number(pr.amount))}
                </span>
              </Link>
            ))
          )}
        </SectionCard>

        {/* Messages */}
        <SectionCard
          title="Unread Messages"
          icon={<MessageSquare className="h-4 w-4 text-primary" />}
          count={unreadThreads.length}
          href="/messages"
        >
          {unreadThreads.length === 0 ? (
            <EmptyCard label="No unread messages." />
          ) : (
            unreadThreads.map((thread) => {
              const latest = thread.messages[0];
              return (
                <Link
                  key={thread.id}
                  href="/messages"
                  className="flex items-start justify-between rounded-md border px-3 py-2 text-sm hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{thread.subject}</p>
                    {latest && <p className="line-clamp-1 text-xs text-muted-foreground">{latest.body}</p>}
                  </div>
                  {latest && <span className="ml-2 shrink-0 text-xs text-muted-foreground">{formatRelativeTime(latest.createdAt)}</span>}
                </Link>
              );
            })
          )}
        </SectionCard>

        {/* Expiring Leases */}
        <SectionCard
          title="Leases Expiring Soon"
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          count={expiringLeases.length}
          href="/renewals"
        >
          {expiringLeases.length === 0 ? (
            <EmptyCard label="No leases expiring in the next 60 days." />
          ) : (
            expiringLeases.map((lease) => {
              const tenant = lease.tenants[0]?.tenant;
              const days = daysUntil(lease.endDate);
              return (
                <Link
                  key={lease.id}
                  href={`/renewals/${lease.id}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {tenant ? `${tenant.firstName} ${tenant.lastName}` : "Unknown tenant"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lease.unit.property.name} · Unit {lease.unit.unitNumber}
                    </p>
                  </div>
                  <Badge
                    variant={days !== null && days <= 30 ? "destructive" : "secondary"}
                    className="ml-2 shrink-0 text-xs"
                  >
                    {days}d
                  </Badge>
                </Link>
              );
            })
          )}
        </SectionCard>

        {/* Applications */}
        <SectionCard
          title="Applications"
          icon={<FileText className="h-4 w-4 text-primary" />}
          count={pendingApps.length}
          href="/applications"
        >
          {pendingApps.length === 0 ? (
            <EmptyCard label="No applications pending review." />
          ) : (
            pendingApps.map((app) => (
              <Link
                key={app.id}
                href={`/applications/${app.id}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:border-primary/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{app.firstName} {app.lastName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {app.property.name}{app.unit ? ` · Unit ${app.unit.unitNumber}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="ml-2 shrink-0 text-xs capitalize">
                  {app.status.replace(/_/g, " ")}
                </Badge>
              </Link>
            ))
          )}
        </SectionCard>

        {/* Needs Review Documents */}
        {needsReviewDocs.length > 0 && (
          <SectionCard
            title="Documents Needing Review"
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            count={needsReviewDocs.length}
            href="/documents"
          >
            {needsReviewDocs.map((doc) => (
              <Link
                key={doc.id}
                href="/documents"
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:border-primary/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{doc.fileName}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {doc.documentType}
                    {doc.confidenceScore != null && ` · ${Math.round(doc.confidenceScore * 100)}% confidence`}
                  </p>
                </div>
              </Link>
            ))}
          </SectionCard>
        )}

      </div>
    </div>
  );
}
