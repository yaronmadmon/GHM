import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";
import { addDays } from "date-fns";

function urgencyStyle(days: number | null) {
  if (days === null) return "bg-muted text-muted-foreground";
  if (days <= 30) return "bg-red-500/10 text-red-600 border-red-200";
  if (days <= 60) return "bg-amber-500/10 text-amber-700 border-amber-200";
  return "bg-emerald-500/10 text-emerald-700 border-emerald-200";
}

export default async function RenewalsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const leases = await prisma.lease.findMany({
    where: {
      organizationId: session.user.organizationId,
      status: "active",
      endDate: { gte: new Date(), lte: addDays(new Date(), 90) },
    },
    include: {
      unit: { include: { property: true } },
      tenants: { include: { tenant: true } },
    },
    orderBy: { endDate: "asc" },
  });

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Renewals</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {leases.length === 0
            ? "No leases expiring in the next 90 days"
            : `${leases.length} lease${leases.length > 1 ? "s" : ""} expiring within 90 days`}
        </p>
      </div>

      {leases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-xl">
          <RefreshCw className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg">No renewals needed</h3>
          <p className="text-muted-foreground text-sm mt-1">No active leases expire within the next 90 days.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {leases.map((lease) => {
              const tenant = lease.tenants.find((lt) => lt.isPrimary)?.tenant ?? lease.tenants[0]?.tenant;
              const days = daysUntil(lease.endDate);
              return (
                <div key={lease.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">
                        {tenant ? `${tenant.firstName} ${tenant.lastName}` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{lease.unit.property.name} · Unit {lease.unit.unitNumber}</p>
                    </div>
                    <Badge className={`text-xs border shrink-0 ${urgencyStyle(days)}`}>
                      {days !== null ? `${days}d` : "—"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      <span>{formatDate(lease.startDate)} – {lease.endDate ? formatDate(lease.endDate) : "MTM"}</span>
                      <span className="ml-3 font-mono">{formatCurrency(Number(lease.rentAmount))}/mo</span>
                    </div>
                    <Link href={`/renewals/${lease.id}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs">Review →</Button>
                    </Link>
                  </div>
                </div>
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
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Current Rent</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expires</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Days Left</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {leases.map((lease) => {
                  const tenant = lease.tenants.find((lt) => lt.isPrimary)?.tenant ?? lease.tenants[0]?.tenant;
                  const days = daysUntil(lease.endDate);
                  return (
                    <tr key={lease.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {days !== null && days <= 30 && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                          <span className="font-medium">
                            {tenant ? `${tenant.firstName} ${tenant.lastName}` : "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {lease.unit.property.name} · Unit {lease.unit.unitNumber}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(Number(lease.rentAmount))}/mo</td>
                      <td className="px-4 py-3">{lease.endDate ? formatDate(lease.endDate) : "—"}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs border ${urgencyStyle(days)}`}>
                          {days !== null ? `${days} days` : "—"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/renewals/${lease.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs">Review →</Button>
                        </Link>
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
