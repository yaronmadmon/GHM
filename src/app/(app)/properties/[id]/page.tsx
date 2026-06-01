import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowLeft, BarChart2, Building2, ExternalLink, FileText, FolderOpen, MapPin, Plus, Users, Wrench } from "lucide-react";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils";
import { PropertyDeleteButton } from "@/components/properties/PropertyActions";
import { PropertyPhotoGallery } from "@/components/properties/PropertyPhotoGallery";
import { PropertyExpensesEditor } from "@/components/properties/PropertyExpensesEditor";
import { PropertyInfoEditor } from "@/components/properties/PropertyInfoEditor";

const STATUS_STYLES: Record<string, string> = {
  occupied: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-900",
  vacant: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-900",
  under_maintenance: "bg-red-500/10 text-red-700 border-red-200 dark:text-red-300 dark:border-red-900",
};

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const [property, activityEvents, propertyDocuments] = await Promise.all([
    prisma.property.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      photos: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
      expenses: true,
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
  }),
    prisma.activityEvent.findMany({
      where: { organizationId: session.user.organizationId, entityType: "property", entityId: id },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.propertyDocument.findMany({
      where: { organizationId: session.user.organizationId, propertyId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  if (!property) notFound();

  const occupiedUnits = property.units.filter((unit) => unit.status === "occupied").length;
  const vacantUnits = property.units.length - occupiedUnits;
  const occupancyPct = property.units.length > 0 ? Math.round((occupiedUnits / property.units.length) * 100) : 0;
  const activeTenants = property.units.flatMap((unit) => {
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

  const propertyInfo = {
    id: property.id,
    name: property.name,
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2,
    city: property.city,
    state: property.state,
    zip: property.zip,
    propertyType: property.propertyType,
    status: property.status,
    description: property.description,
    purchasePrice: property.purchasePrice == null ? null : Number(property.purchasePrice),
    purchaseDate: property.purchaseDate,
  };

  return (
    <div className="page-shell max-w-6xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/properties">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Properties
          </Button>
        </Link>
      </div>

      <section className="office-header">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="page-kicker">Property file</p>
              <Badge className={`border text-xs ${STATUS_STYLES[property.status] ?? ""}`}>{property.status.replace("_", " ")}</Badge>
            </div>
            <h1 className="page-title mt-2 truncate">{property.name}</h1>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              {property.addressLine1}, {property.city}, {property.state} {property.zip}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <PropertyInfoEditor property={propertyInfo} />
            <Link href={`/properties/${id}/report`}>
              <Button variant="outline" size="sm" className="gap-2">
                <BarChart2 className="h-4 w-4" />
                Report
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-md border bg-background/55 p-3">
            <p className="text-xs text-muted-foreground">Units</p>
            <p className="mt-1 font-mono text-xl font-semibold">{property.units.length}</p>
          </div>
          <div className="rounded-md border bg-background/55 p-3">
            <p className="text-xs text-muted-foreground">Occupancy</p>
            <p className="mt-1 font-mono text-xl font-semibold">{occupancyPct}%</p>
          </div>
          <div className="rounded-md border bg-background/55 p-3">
            <p className="text-xs text-muted-foreground">Vacant</p>
            <p className="mt-1 font-mono text-xl font-semibold text-amber-700 dark:text-amber-300">{vacantUnits}</p>
          </div>
          <div className="rounded-md border bg-background/55 p-3">
            <p className="text-xs text-muted-foreground">Open issues</p>
            <p className="mt-1 font-mono text-xl font-semibold">{property._count.maintenanceRequests}</p>
          </div>
        </div>
      </section>

      <PropertyPhotoGallery propertyId={id} initialPhotos={property.photos} />

      <PropertyExpensesEditor
        propertyId={id}
        initialExpenses={property.expenses ? {
          propertyTaxMonthly: property.expenses.propertyTaxMonthly !== null ? Number(property.expenses.propertyTaxMonthly) : null,
          waterSewerMonthly: property.expenses.waterSewerMonthly !== null ? Number(property.expenses.waterSewerMonthly) : null,
          electricityMonthly: property.expenses.electricityMonthly !== null ? Number(property.expenses.electricityMonthly) : null,
          gasMonthly: property.expenses.gasMonthly !== null ? Number(property.expenses.gasMonthly) : null,
          insuranceMonthly: property.expenses.insuranceMonthly !== null ? Number(property.expenses.insuranceMonthly) : null,
          mortgageMonthly: property.expenses.mortgageMonthly !== null ? Number(property.expenses.mortgageMonthly) : null,
          hoaMonthly: property.expenses.hoaMonthly !== null ? Number(property.expenses.hoaMonthly) : null,
          otherMonthly: property.expenses.otherMonthly !== null ? Number(property.expenses.otherMonthly) : null,
          aiEstimatedAt: property.expenses.aiEstimatedAt?.toISOString() ?? null,
          lastEditedAt: property.expenses.lastEditedAt?.toISOString() ?? null,
        } : null}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" />
            Units ({property.units.length})
          </CardTitle>
          <Link href={`/properties/${id}/units/new`}>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Add unit
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {property.units.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No units yet.</p>
          ) : (
            <div className="divide-y">
              {property.units.map((unit) => {
                const activeLease = unit.leases[0];
                const primaryTenant = activeLease?.tenants.find((lt) => lt.isPrimary)?.tenant ?? activeLease?.tenants[0]?.tenant;
                const lastPayment = activeLease?.rentPayments[0];
                return (
                  <div key={unit.id} className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Unit {unit.unitNumber}</p>
                      {unit.bedrooms != null && (
                        <p className="text-xs text-muted-foreground">
                          {String(unit.bedrooms)}bd / {String(unit.bathrooms)}ba
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {primaryTenant ? (
                        <>
                          <Link href={`/tenants/${primaryTenant.id}`} className="flex items-center justify-end gap-1 text-sm font-medium text-primary hover:underline">
                            <Users className="h-3.5 w-3.5" />
                            {primaryTenant.firstName} {primaryTenant.lastName}
                          </Link>
                          {activeLease ? (
                            <Link href={`/leases/${activeLease.id}`} className="text-xs text-muted-foreground hover:text-primary">
                              {formatCurrency(Number(activeLease.rentAmount))}/mo
                              {lastPayment && ` - ${lastPayment.status}`}
                            </Link>
                          ) : null}
                        </>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={`border text-xs ${STATUS_STYLES[unit.status] ?? ""}`}>{unit.status.replace("_", " ")}</Badge>
                          <Link href={`/leases/new?propertyId=${id}&unitId=${unit.id}`} className="text-xs text-primary hover:underline">
                            Add lease
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

      {activeTenants.length > 0 && (
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Tenants ({activeTenants.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {activeTenants.map(({ tenant, unitNumber, leaseId, rentAmount, lastPayment }) => (
                <div key={tenant.id} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {tenant.firstName[0]}{tenant.lastName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/tenants/${tenant.id}`} className="block text-sm font-medium hover:text-primary">
                      {tenant.firstName} {tenant.lastName}
                    </Link>
                    <p className="text-xs text-muted-foreground">Unit {unitNumber} - {formatCurrency(Number(rentAmount))}/mo</p>
                  </div>
                  <div className="shrink-0 space-y-1 text-right">
                    {lastPayment && (
                      <Badge
                        variant={lastPayment.status === "paid" ? "secondary" : lastPayment.status === "overdue" ? "destructive" : "outline"}
                        className="text-xs"
                      >
                        {lastPayment.status}
                      </Badge>
                    )}
                    <Link href={`/leases/${leaseId}`} className="block text-xs text-muted-foreground hover:text-primary">
                      View lease
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
          <CardTitle className="text-base">Property Details</CardTitle>
          <PropertyInfoEditor property={propertyInfo} variant="ghost" />
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-muted-foreground">Type</p><p className="capitalize">{property.propertyType.replace("_", " ")}</p></div>
          <div><p className="text-xs text-muted-foreground">Status</p><p className="capitalize">{property.status.replace("_", " ")}</p></div>
          {property.purchasePrice != null && (
            <div><p className="text-xs text-muted-foreground">Purchase Price</p><p>{formatCurrency(Number(property.purchasePrice))}</p></div>
          )}
          {property.purchaseDate && (
            <div><p className="text-xs text-muted-foreground">Purchase Date</p><p>{formatDate(property.purchaseDate)}</p></div>
          )}
          {property.description && (
            <div className="col-span-2"><p className="text-xs text-muted-foreground">Notes</p><p>{property.description}</p></div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href={`/maintenance?property=${id}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <Wrench className="h-4 w-4" />
            View maintenance
          </Button>
        </Link>
        <Link href={`/leases/new?propertyId=${id}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Create lease
          </Button>
        </Link>
        <PropertyDeleteButton propertyId={id} propertyName={property.name} />
      </div>

      {/* Documents filed to this property */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="h-4 w-4 text-primary" />
            Documents ({propertyDocuments.length})
          </CardTitle>
          <Link href="/documents">
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Upload
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {propertyDocuments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <FileText className="h-8 w-8 opacity-30" />
              <p className="text-sm">No documents filed yet.</p>
              <Link href="/documents" className="text-xs text-primary hover:underline">
                Go to Document Center to upload
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {propertyDocuments.map((doc) => {
                const isDataUri = doc.fileUrl.startsWith("data:");
                const amountStr = doc.amount != null
                  ? `$${Number(doc.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : null;
                const dateStr = doc.issueDate
                  ? doc.issueDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                  : doc.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                return (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{doc.fileName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {doc.vendor && <span>{doc.vendor} · </span>}
                        {amountStr && <span className="font-mono">{amountStr} · </span>}
                        {dateStr}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        doc.documentType === "notice" ? "bg-amber-100 text-amber-700" :
                        doc.documentType === "utility" ? "bg-blue-100 text-blue-700" :
                        doc.documentType === "tax" ? "bg-red-100 text-red-700" :
                        doc.documentType === "insurance" ? "bg-purple-100 text-purple-700" :
                        "bg-muted text-muted-foreground"
                      }`}>{doc.documentType}</span>
                      {isDataUri ? (
                        <a href={doc.fileUrl} download={doc.fileName} className="flex items-center gap-0.5 text-xs text-primary hover:underline">
                          Download
                        </a>
                      ) : (
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-xs text-primary hover:underline">
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {activityEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {activityEvents.map((event) => {
                const labelMap: Record<string, string> = {
                  payment_recorded: "Payment recorded",
                  status_changed: "Status changed",
                  created: "Record created",
                  updated: "Record updated",
                };
                const label = labelMap[event.eventType] ??
                  event.eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <div key={event.id} className="flex gap-3 border-b py-2 text-sm last:border-0">
                    <div className="w-36 shrink-0">
                      <p className="text-muted-foreground">{formatDate(event.createdAt)}</p>
                      <p className="text-xs text-muted-foreground">{formatRelativeTime(event.createdAt)}</p>
                    </div>
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {event.entityType}{event.actor?.name ? ` · ${event.actor.name}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
