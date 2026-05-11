import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2, ExternalLink } from "lucide-react";
import { UnitPhotoGallery } from "@/components/units/UnitPhotoGallery";
import { VacancyListingActions } from "./VacancyListingActions";
import { formatCurrency } from "@/lib/utils";

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

const LISTING_PLATFORMS = [
  { name: "Zillow Rental Manager", url: "https://www.zillow.com/rental-manager/properties/new", color: "bg-blue-600 hover:bg-blue-700" },
  { name: "Zumper", url: "https://www.zumper.com/list-your-rental", color: "bg-purple-600 hover:bg-purple-700" },
  { name: "Apartments.com", url: "https://www.apartments.com/rental-manager/", color: "bg-green-600 hover:bg-green-700" },
  { name: "Facebook Marketplace", url: "https://www.facebook.com/marketplace/create/rental", color: "bg-[#1877F2] hover:bg-[#166FE5]" },
];

export default async function VacancyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const unit = await prisma.unit.findFirst({
    where: { id, property: { organizationId: session.user.organizationId } },
    include: {
      property: true,
      photos: { orderBy: { sortOrder: "asc" } },
      leases: {
        orderBy: { endDate: "desc" },
        take: 1,
        include: { tenants: { include: { tenant: true }, where: { isPrimary: true } } },
      },
    },
  });
  if (!unit) notFound();

  const lastLease = unit.leases[0];
  const lastTenant = lastLease?.tenants[0]?.tenant;
  const vacantSince = lastLease?.endDate ?? unit.createdAt;
  const days = daysSince(new Date(vacantSince));

  const lastRent = lastLease ? Number(lastLease.rentAmount) : null;
  const propertyAddress = [unit.property.addressLine1, unit.property.city].filter(Boolean).join(", ");

  const listingDescription = [
    `📍 ${propertyAddress || unit.property.name} — Unit ${unit.unitNumber}`,
    unit.bedrooms != null ? `🛏 ${Number(unit.bedrooms)} bedroom${Number(unit.bedrooms) !== 1 ? "s" : ""}` : null,
    unit.bathrooms != null ? `🚿 ${Number(unit.bathrooms)} bathroom${Number(unit.bathrooms) !== 1 ? "s" : ""}` : null,
    unit.sqft != null ? `📐 ${unit.sqft.toLocaleString()} sq ft` : null,
    lastRent != null ? `💰 ${formatCurrency(lastRent)}/month` : null,
    unit.notes ? `\n${unit.notes}` : null,
  ].filter(Boolean).join("\n");

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/vacancy" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{unit.property.name} — Unit {unit.unitNumber}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Vacant for {days} days</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: info + photos */}
        <div className="lg:col-span-2 space-y-6">
          {/* Unit info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Unit Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Property</p>
                <Link href={`/properties/${unit.propertyId}`} className="font-medium hover:text-primary transition-colors">
                  {unit.property.name}
                </Link>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Unit</p>
                <p className="font-medium">{unit.unitNumber}</p>
              </div>
              {unit.bedrooms != null && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Bedrooms</p>
                  <p className="font-medium">{Number(unit.bedrooms)}</p>
                </div>
              )}
              {unit.bathrooms != null && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Bathrooms</p>
                  <p className="font-medium">{Number(unit.bathrooms)}</p>
                </div>
              )}
              {unit.sqft != null && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Square feet</p>
                  <p className="font-medium">{unit.sqft.toLocaleString()}</p>
                </div>
              )}
              {lastRent != null && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Last rent</p>
                  <p className="font-medium">{formatCurrency(lastRent)}/mo</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Vacant since</p>
                <p className="font-medium">
                  {new Date(vacantSince).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
              {lastTenant && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Last tenant</p>
                  <Link href={`/tenants/${lastTenant.id}`} className="font-medium hover:text-primary transition-colors">
                    {lastTenant.firstName} {lastTenant.lastName}
                  </Link>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Status</p>
                <Badge className="text-xs border bg-amber-500/10 text-amber-700 border-amber-200">Vacant {days}d</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Listing Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <UnitPhotoGallery unitId={unit.id} initialPhotos={unit.photos} />
            </CardContent>
          </Card>
        </div>

        {/* Right column: listing tools */}
        <div className="space-y-4">
          {/* Copy description */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Listing Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans bg-muted/50 rounded-lg p-3 border">
                {listingDescription}
              </pre>
              <VacancyListingActions description={listingDescription} />
            </CardContent>
          </Card>

          {/* Platform links */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">List on Free Platforms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {LISTING_PLATFORMS.map((platform) => (
                <a
                  key={platform.name}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${platform.color}`}
                >
                  {platform.name}
                  <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                </a>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                Copy your listing description above, then paste it into any of these free platforms.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
