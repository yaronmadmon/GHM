import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ArrowLeft, MapPin, Wrench, Plus, Users } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PropertyDeleteButton } from "@/components/properties/PropertyActions";

const STATUS_STYLES: Record<string, string> = {
  occupied: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  vacant: "bg-amber-500/10 text-amber-700 border-amber-200",
  under_maintenance: "bg-red-500/10 text-red-600 border-red-200",
};

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const property = await prisma.property.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      photos: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
      units: {
        include: {
          leases: {
            where: { status: "active" },
            include: { tenants: { include: { tenant: true } }, rentPayments: { orderBy: { dueDate: "desc" }, take: 1 } },
          },
        },
        orderBy: { unitNumber: "asc" },
      },
      _count: { select: { maintenanceRequests: { where: { status: { in: ["open", "in_progress"] } } } } },
    },
  });

  if (!property) notFound();

  const cover = property.photos.find((p) => p.isCover) ?? property.photos[0];
  const occupiedUnits = property.units.filter((u) => u.status === "occupied").length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/properties">
          <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold truncate">{property.name}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {property.addressLine1}, {property.city}, {property.state} {property.zip}
          </p>
        </div>
        <Badge className={`border shrink-0 ${STATUS_STYLES[property.status] ?? ""}`}>{property.status}</Badge>
      </div>

      {/* Cover photo */}
      {cover && (
        <div className="rounded-xl overflow-hidden h-48 md:h-64">
          <img src={cover.url} alt={property.name} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{property.units.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total units</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{occupiedUnits}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Occupied</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{property._count.maintenanceRequests}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Open issues</p>
          </CardContent>
        </Card>
      </div>

      {/* Units */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Building2 className="h-4 w-4" />Units ({property.units.length})
          </CardTitle>
          <Link href={`/properties/${id}/units/new`}>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" />Add unit
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {property.units.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 pb-4">No units yet.</p>
          ) : (
            <div className="divide-y">
              {property.units.map((unit) => {
                const activeLease = unit.leases[0];
                const primaryTenant = activeLease?.tenants.find((lt) => lt.isPrimary)?.tenant ?? activeLease?.tenants[0]?.tenant;
                const lastPayment = activeLease?.rentPayments[0];
                return (
                  <div key={unit.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="font-medium text-sm">Unit {unit.unitNumber}</p>
                      {unit.bedrooms != null && (
                        <p className="text-xs text-muted-foreground">
                          {String(unit.bedrooms)}bd · {String(unit.bathrooms)}ba
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {primaryTenant ? (
                        <>
                          <Link href={`/tenants/${primaryTenant.id}`} className="text-sm font-medium text-primary hover:underline flex items-center gap-1 justify-end">
                            <Users className="h-3.5 w-3.5" />
                            {primaryTenant.firstName} {primaryTenant.lastName}
                          </Link>
                          {activeLease ? (
                            <Link href={`/leases/${activeLease.id}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                              {formatCurrency(Number(activeLease.rentAmount))}/mo
                              {lastPayment && ` · ${lastPayment.status}`}
                            </Link>
                          ) : null}
                        </>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={`text-xs border ${STATUS_STYLES[unit.status] ?? ""}`}>{unit.status}</Badge>
                          <Link href={`/leases/new?propertyId=${id}&unitId=${unit.id}`} className="text-xs text-primary hover:underline">
                            + Add lease
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tenants */}
      {(() => {
        const tenants = property.units.flatMap((unit) => {
          const activeLease = unit.leases[0];
          if (!activeLease) return [];
          return activeLease.tenants.map((lt) => ({
            tenant: lt.tenant,
            unitNumber: unit.unitNumber,
            leaseId: activeLease.id,
            rentAmount: activeLease.rentAmount,
            lastPayment: activeLease.rentPayments[0],
          }));
        });
        if (tenants.length === 0) return null;
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />Tenants ({tenants.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {tenants.map(({ tenant, unitNumber, leaseId, rentAmount, lastPayment }) => (
                  <Link
                    key={tenant.id}
                    href={`/tenants/${tenant.id}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                      {tenant.firstName[0]}{tenant.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm group-hover:text-primary transition-colors">
                        {tenant.firstName} {tenant.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">Unit {unitNumber} · {formatCurrency(Number(rentAmount))}/mo</p>
                    </div>
                    <div className="text-right shrink-0">
                      {lastPayment && (
                        <Badge
                          variant={lastPayment.status === "paid" ? "secondary" : lastPayment.status === "overdue" ? "destructive" : "outline"}
                          className="text-xs"
                        >
                          {lastPayment.status}
                        </Badge>
                      )}
                      <Link href={`/leases/${leaseId}`} onClick={(e) => e.stopPropagation()} className="block text-xs text-muted-foreground hover:text-primary mt-0.5 transition-colors">
                        View lease
                      </Link>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Property details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Property Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-muted-foreground text-xs">Type</p><p className="capitalize">{property.propertyType.replace("_", " ")}</p></div>
          <div><p className="text-muted-foreground text-xs">Status</p><p className="capitalize">{property.status.replace("_", " ")}</p></div>
          {property.purchasePrice != null && (
            <div><p className="text-muted-foreground text-xs">Purchase Price</p><p>{formatCurrency(Number(property.purchasePrice))}</p></div>
          )}
          {property.purchaseDate && (
            <div><p className="text-muted-foreground text-xs">Purchase Date</p><p>{formatDate(property.purchaseDate)}</p></div>
          )}
          {property.description && (
            <div className="col-span-2"><p className="text-muted-foreground text-xs">Notes</p><p>{property.description}</p></div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Link href={`/maintenance?property=${id}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <Wrench className="h-4 w-4" />View maintenance
          </Button>
        </Link>
        <Link href={`/leases/new?propertyId=${id}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />Create lease
          </Button>
        </Link>
        <PropertyDeleteButton propertyId={id} propertyName={property.name} />
      </div>
    </div>
  );
}
