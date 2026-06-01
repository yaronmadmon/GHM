import Link from "next/link";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FileText, Plus } from "lucide-react";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-900",
  expired: "bg-muted text-muted-foreground",
  terminated: "bg-red-500/10 text-red-700 border-red-200 dark:text-red-300 dark:border-red-900",
  pending: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-900",
};

function signingLabel(status: string) {
  if (status === "fully_signed") return "Fully signed";
  if (status === "tenant_signed") return "Awaiting your signature";
  if (status === "sent") return "Sent to tenant";
  return "Draft";
}

export default async function LeasesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const leases = await prisma.lease.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      unit: { include: { property: true } },
      tenants: { include: { tenant: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const soon = addDays(new Date(), 60);
  const activeCount = leases.filter((lease) => lease.status === "active").length;

  return (
    <div className="page-shell page-stack">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">Leasing</p>
          <h1 className="page-title mt-2">Leases</h1>
          <p className="mt-2 text-sm text-muted-foreground">{activeCount} active / {leases.length} total</p>
        </div>
        <Link href="/leases/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Create lease
          </Button>
        </Link>
      </div>

      {leases.length === 0 ? (
        <div className="empty-state">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="font-heading text-3xl font-semibold">No leases yet</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">Create a lease to connect tenants, units, rent, deposits, and signatures.</p>
          <Link href="/leases/new" className="mt-5">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Create lease
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {leases.map((lease) => {
              const primaryTenant = lease.tenants.find((lt) => lt.isPrimary)?.tenant ?? lease.tenants[0]?.tenant;
              const expiring = lease.endDate && lease.status === "active" && new Date(lease.endDate) <= soon;
              const days = daysUntil(lease.endDate);
              return (
                <Link key={lease.id} href={`/leases/${lease.id}`} className="block">
                  <article className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {primaryTenant ? `${primaryTenant.firstName} ${primaryTenant.lastName}` : "No tenant"}
                          {lease.tenants.length > 1 && <span className="ml-1 text-xs text-muted-foreground">+{lease.tenants.length - 1}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{lease.unit.property.name} - Unit {lease.unit.unitNumber}</p>
                      </div>
                      <Badge className={`shrink-0 border text-xs ${STATUS_STYLES[lease.status] ?? ""}`}>{lease.status}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {expiring && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                      <span className={`text-xs ${expiring ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
                        {formatDate(lease.startDate)} - {lease.endDate ? formatDate(lease.endDate) : "Month-to-month"}
                      </span>
                      {expiring && days !== null && <span className="text-xs text-amber-700 dark:text-amber-300">{days}d left</span>}
                      <span className="ml-auto font-mono text-xs text-muted-foreground">{formatCurrency(Number(lease.rentAmount))}/mo</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{signingLabel(lease.signingStatus)}</p>
                  </article>
                </Link>
              );
            })}
          </div>

          <div className="data-table-shell hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tenant</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Property / Unit</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dates</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Rent</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Signing</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leases.map((lease) => {
                  const primaryTenant = lease.tenants.find((lt) => lt.isPrimary)?.tenant ?? lease.tenants[0]?.tenant;
                  const expiring = lease.endDate && lease.status === "active" && new Date(lease.endDate) <= soon;
                  const days = daysUntil(lease.endDate);
                  return (
                    <tr key={lease.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link href={`/leases/${lease.id}`} className="font-medium hover:text-primary">
                          {primaryTenant ? `${primaryTenant.firstName} ${primaryTenant.lastName}` : "No tenant"}
                        </Link>
                        {lease.tenants.length > 1 && <span className="ml-1 text-xs text-muted-foreground">+{lease.tenants.length - 1}</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {lease.unit.property.name} - Unit {lease.unit.unitNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {expiring && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
                          <span className={expiring ? "font-medium text-amber-700 dark:text-amber-300" : ""}>
                            {formatDate(lease.startDate)} - {lease.endDate ? formatDate(lease.endDate) : "Month-to-month"}
                          </span>
                        </div>
                        {expiring && days !== null && <p className="text-xs text-amber-700 dark:text-amber-300">Expires in {days} days</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(Number(lease.rentAmount))}/mo</td>
                      <td className="px-4 py-3">
                        <Badge className={`border text-xs ${STATUS_STYLES[lease.status] ?? ""}`}>{lease.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{signingLabel(lease.signingStatus)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
