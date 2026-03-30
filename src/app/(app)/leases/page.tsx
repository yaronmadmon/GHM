import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Plus, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";
import { addDays } from "date-fns";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  expired: "bg-muted text-muted-foreground",
  terminated: "bg-red-500/10 text-red-600 border-red-200",
  pending: "bg-blue-500/10 text-blue-600 border-blue-200",
};

export default async function LeasesPage() {
  const session = await auth();
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

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leases</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{leases.length} leases</p>
        </div>
        <Link href="/leases/new">
          <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />New</Button>
        </Link>
      </div>

      {leases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-xl">
          <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg">No leases yet</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Create a lease to link tenants to units</p>
          <Link href="/leases/new"><Button size="sm"><Plus className="h-4 w-4 mr-2" />New lease</Button></Link>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {leases.map((lease) => {
              const primaryTenant = lease.tenants.find((lt) => lt.isPrimary)?.tenant ?? lease.tenants[0]?.tenant;
              const expiring = lease.endDate && lease.status === "active" && new Date(lease.endDate) <= soon;
              const days = daysUntil(lease.endDate);
              return (
                <Link key={lease.id} href={`/leases/${lease.id}`}>
                  <div className="rounded-lg border p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {primaryTenant ? `${primaryTenant.firstName} ${primaryTenant.lastName}` : "—"}
                          {lease.tenants.length > 1 && (
                            <span className="text-xs text-muted-foreground ml-1">+{lease.tenants.length - 1}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{lease.unit.property.name} · Unit {lease.unit.unitNumber}</p>
                      </div>
                      <Badge className={`text-xs border shrink-0 ${STATUS_STYLES[lease.status] ?? ""}`}>{lease.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {expiring && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                      <span className={`text-xs ${expiring ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                        {formatDate(lease.startDate)} – {lease.endDate ? formatDate(lease.endDate) : "MTM"}
                      </span>
                      {expiring && days !== null && (
                        <span className="text-xs text-amber-500">{days}d left</span>
                      )}
                      <span className="ml-auto text-xs font-mono text-muted-foreground">{formatCurrency(Number(lease.rentAmount))}/mo</span>
                    </div>
                    {lease.signingStatus !== "draft" && (
                      <div className="mt-1.5">
                        {lease.signingStatus === "fully_signed" && <span className="text-xs text-green-600 font-medium">✓ Fully signed</span>}
                        {lease.signingStatus === "tenant_signed" && <span className="text-xs text-amber-600 font-medium">Awaiting your signature</span>}
                        {lease.signingStatus === "sent" && <span className="text-xs text-muted-foreground">Sent to tenant</span>}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tenant</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Property / Unit</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Dates</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Rent</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Signing</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leases.map((lease) => {
                  const primaryTenant = lease.tenants.find((lt) => lt.isPrimary)?.tenant ?? lease.tenants[0]?.tenant;
                  const expiring = lease.endDate && lease.status === "active" && new Date(lease.endDate) <= soon;
                  const days = daysUntil(lease.endDate);
                  return (
                    <tr key={lease.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/leases/${lease.id}`} className="font-medium hover:text-primary">
                          {primaryTenant ? `${primaryTenant.firstName} ${primaryTenant.lastName}` : "—"}
                        </Link>
                        {lease.tenants.length > 1 && (
                          <span className="text-xs text-muted-foreground ml-1">+{lease.tenants.length - 1}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {lease.unit.property.name} · Unit {lease.unit.unitNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {expiring && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                          <span className={expiring ? "text-amber-600 font-medium" : ""}>
                            {formatDate(lease.startDate)} – {lease.endDate ? formatDate(lease.endDate) : "Month-to-month"}
                          </span>
                        </div>
                        {expiring && days !== null && (
                          <p className="text-xs text-amber-500">Expires in {days} days</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(Number(lease.rentAmount))}/mo</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs border ${STATUS_STYLES[lease.status] ?? ""}`}>{lease.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {lease.signingStatus === "fully_signed" && <span className="text-xs text-green-600 font-medium">✓ Fully signed</span>}
                        {lease.signingStatus === "tenant_signed" && <span className="text-xs text-amber-600 font-medium">Awaiting your signature</span>}
                        {lease.signingStatus === "sent" && <span className="text-xs text-muted-foreground">Sent to tenant</span>}
                        {lease.signingStatus === "draft" && <span className="text-xs text-muted-foreground">Not sent</span>}
                      </td>
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
