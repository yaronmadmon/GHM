import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Plus } from "lucide-react";
import { computePropertyHealth, HEALTH_STYLES, HEALTH_LABELS } from "@/lib/property-health";

const STATUS_COLORS: Record<string, string> = {
  occupied: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-900",
  vacant: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-900",
  under_maintenance: "bg-red-500/10 text-red-700 border-red-200 dark:text-red-300 dark:border-red-900",
};

export default async function PropertiesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const orgId = session.user.organizationId;
  const now = new Date();
  const in30Days = addDays(now, 30);

  const [properties, maintenanceCounts, emergencyCounts, overdueCounts, expiringCounts] =
    await Promise.all([
      prisma.property.findMany({
        where: { organizationId: orgId, archivedAt: null },
        include: {
          units: { select: { id: true, status: true } },
          photos: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1 },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.maintenanceRequest.groupBy({
        by: ["propertyId"],
        where: { organizationId: orgId, status: { in: ["open", "in_progress", "pending_parts"] } },
        _count: { id: true },
      }),
      prisma.maintenanceRequest.groupBy({
        by: ["propertyId"],
        where: { organizationId: orgId, priority: "emergency", status: { in: ["open", "in_progress"] } },
        _count: { id: true },
      }),
      // Overdue rent: count via leases → units → property
      prisma.rentPayment.findMany({
        where: { organizationId: orgId, status: "overdue" },
        select: { lease: { select: { unit: { select: { propertyId: true } } } } },
      }),
      prisma.lease.groupBy({
        by: ["unitId"],
        where: {
          organizationId: orgId,
          status: "active",
          endDate: { gte: now, lte: in30Days },
        },
        _count: { id: true },
      }),
    ]);

  // Build lookup maps
  const maintMap = new Map(maintenanceCounts.map((r) => [r.propertyId, r._count.id]));
  const emergMap = new Map(emergencyCounts.map((r) => [r.propertyId, r._count.id]));

  // Count overdue payments per property
  const overdueMap = new Map<string, number>();
  for (const op of overdueCounts) {
    const pid = op.lease?.unit?.propertyId;
    if (pid) overdueMap.set(pid, (overdueMap.get(pid) ?? 0) + 1);
  }

  // Count expiring leases per property — need unit→property mapping
  const unitIds = expiringCounts.map((r) => r.unitId);
  const unitPropMap = unitIds.length
    ? await prisma.unit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, propertyId: true },
      })
    : [];
  const unitToProp = new Map(unitPropMap.map((u) => [u.id, u.propertyId]));
  const expiringMap = new Map<string, number>();
  for (const row of expiringCounts) {
    const pid = unitToProp.get(row.unitId);
    if (pid) expiringMap.set(pid, (expiringMap.get(pid) ?? 0) + (row._count.id ?? 0));
  }

  const totalUnits = properties.reduce((sum, p) => sum + p.units.length, 0);

  return (
    <div className="page-shell page-stack">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">Portfolio</p>
          <h1 className="page-title mt-2">Properties</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {properties.length} properties / {totalUnits} total units
          </p>
        </div>
        <Link href="/properties/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add property
          </Button>
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="empty-state">
          <Building2 className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="font-heading text-3xl font-semibold">No properties yet</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Add your first property to start organizing units, tenants, rent, and maintenance.
          </p>
          <Link href="/properties/new" className="mt-5">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add property
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => {
            const total = property.units.length;
            const occupied = property.units.filter((u) => u.status === "occupied").length;
            const maintenanceUnits = property.units.filter((u) => u.status === "under_maintenance").length;
            const vacant = total - occupied;
            const displayStatus =
              total > 0 && occupied === total
                ? "occupied"
                : maintenanceUnits > 0
                  ? "under_maintenance"
                  : "vacant";
            const cover = property.photos[0]?.url;

            const health = computePropertyHealth({
              totalUnits: total,
              occupiedUnits: occupied,
              openMaintenanceCount: maintMap.get(property.id) ?? 0,
              emergencyMaintenanceCount: emergMap.get(property.id) ?? 0,
              overdueRentCount: overdueMap.get(property.id) ?? 0,
              expiringLeaseCount: expiringMap.get(property.id) ?? 0,
            });

            return (
              <Link key={property.id} href={`/properties/${property.id}`} className="group block">
                <article className="overflow-hidden rounded-lg border bg-card shadow-sm transition-[border-color,box-shadow,transform] group-hover:-translate-y-0.5 group-hover:border-primary/35 group-hover:shadow-md">
                  <div className="relative h-36 bg-muted">
                    {cover ? (
                      <img src={cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,var(--muted),var(--card))]">
                        <Building2 className="h-10 w-10 text-primary/35" />
                      </div>
                    )}
                    <div className="absolute left-3 top-3 flex items-center gap-1.5">
                      <Badge className={`border text-xs ${STATUS_COLORS[displayStatus] ?? ""}`}>
                        {displayStatus.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="absolute right-3 top-3">
                      <Badge
                        className={`border text-xs ${HEALTH_STYLES[health.level]}`}
                        title={health.reasons.join(" · ") || "No issues detected"}
                      >
                        {HEALTH_LABELS[health.level]}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <div>
                      <h3 className="font-heading text-2xl font-semibold leading-tight">
                        {property.name}
                      </h3>
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          {property.addressLine1}, {property.city}, {property.state} {property.zip}
                        </span>
                      </p>
                      {health.reasons.length > 0 && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {health.reasons.join(" · ")}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t pt-3 text-sm">
                      <div>
                        <p className="font-mono font-semibold">{total}</p>
                        <p className="text-xs text-muted-foreground">Units</p>
                      </div>
                      <div>
                        <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                          {occupied}
                        </p>
                        <p className="text-xs text-muted-foreground">Occupied</p>
                      </div>
                      <div>
                        <p className="font-mono font-semibold text-amber-700 dark:text-amber-300">
                          {vacant}
                        </p>
                        <p className="text-xs text-muted-foreground">Vacant</p>
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
