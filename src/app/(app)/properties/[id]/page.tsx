import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ArrowLeft, MapPin, Wrench, Plus, Users } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

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
                          {activeLease && (
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(Number(activeLease.rentAmount))}/mo
                              {lastPayment && ` · ${lastPayment.status}`}
                            </p>
                          )}
                        </>
                      ) : (
                        <Badge className={`text-xs border ${STATUS_STYLES[unit.status] ?? ""}`}>{unit.status}</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
        <Link href="/leases/new">
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />Create lease
          </Button>
        </Link>
      </div>
    </div>
  );
}
