import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Plus, Mail, Phone } from "lucide-react";
import { getInitials } from "@/lib/utils";

export default async function TenantsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const orgId = session.user.organizationId;

  // Get all active leases with their tenants (one card per unit)
  const activeLeases = await prisma.lease.findMany({
    where: { organizationId: orgId, status: "active" },
    include: {
      unit: { include: { property: true } },
      tenants: { include: { tenant: true }, orderBy: { isPrimary: "desc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by unit — if multiple active leases exist for the same unit (e.g. imported separately),
  // merge their tenants into a single card rather than showing duplicates
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

  // Tenants with no active lease — shown individually
  const tenantIdsWithLease = new Set(activeLeases.flatMap((l) => l.tenants.map((lt) => lt.tenantId)));
  const unattached = await prisma.tenant.findMany({
    where: { organizationId: orgId, id: { notIn: [...tenantIdsWithLease] } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const totalTenants = tenantIdsWithLease.size + unattached.length; // count of people, not cards

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tenants</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{totalTenants} tenant{totalTenants !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/tenants/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />Add tenant
          </Button>
        </Link>
      </div>

      {totalTenants === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-xl">
          <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg">No tenants yet</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Add tenants and link them to leases</p>
          <Link href="/tenants/new"><Button size="sm"><Plus className="h-4 w-4 mr-2" />Add tenant</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* One card per unit (groups co-tenants even across separate leases) */}
          {groupedUnits.map(({ lease, tenants }) => {
            const tenantList = tenants.map((lt) => lt.tenant);
            const primary = tenantList[0];
            if (!primary) return null;
            return (
              <Card key={lease.unitId} className="relative hover:shadow-md transition-shadow cursor-pointer">
                <Link
                  href={`/tenants/${primary.id}`}
                  className="absolute inset-0 z-0 rounded-xl"
                  aria-label={`Open tenant file for ${primary.firstName} ${primary.lastName}`}
                />
                <CardContent className="p-4 space-y-3">
                  {/* Avatars + unit */}
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {tenantList.slice(0, 3).map((t) => (
                        <div key={t.id} className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-sm ring-2 ring-background shrink-0">
                          {getInitials(`${t.firstName} ${t.lastName}`)}
                        </div>
                      ))}
                    </div>
                    <div className="min-w-0">
                      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200">Active</Badge>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {lease.unit.property.name} · Unit {lease.unit.unitNumber}
                      </p>
                    </div>
                  </div>

                  {/* Each tenant's info */}
                  <div className="space-y-2 border-t pt-2">
                    {tenantList.map((t, idx) => (
                      <div key={t.id} className="relative z-10">
                        <Link href={`/tenants/${t.id}`} className="font-medium text-sm hover:text-primary transition-colors">
                          {t.firstName} {t.lastName}
                          {idx === 0 && tenantList.length > 1 && (
                            <span className="ml-1.5 text-xs text-muted-foreground font-normal">(primary)</span>
                          )}
                        </Link>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {t.email && (
                            <a href={`mailto:${t.email}`} className="relative z-10 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                              <Mail className="h-3 w-3" />{t.email}
                            </a>
                          )}
                          {t.phone && (
                            <a href={`tel:${t.phone}`} className="relative z-10 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                              <Phone className="h-3 w-3" />{t.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Link href={`/leases/${lease.id}`} className="relative z-10 block text-xs text-primary hover:underline">
                    View lease →
                  </Link>
                </CardContent>
              </Card>
            );
          })}

          {/* Tenants with no active lease */}
          {unattached.map((tenant) => (
            <Link key={tenant.id} href={`/tenants/${tenant.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground shrink-0">
                    {getInitials(`${tenant.firstName} ${tenant.lastName}`)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{tenant.firstName} {tenant.lastName}</h3>
                      <Badge variant="outline" className="text-xs text-muted-foreground">No lease</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 mt-1.5">
                      {tenant.email && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{tenant.email}</span>}
                      {tenant.phone && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{tenant.phone}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
