import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DoorOpen, Camera } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function vacancyBadge(days: number) {
  if (days > 30) return "bg-red-500/10 text-red-600 border-red-200";
  if (days > 14) return "bg-amber-500/10 text-amber-700 border-amber-200";
  return "bg-emerald-500/10 text-emerald-700 border-emerald-200";
}

export default async function VacancyPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const units = await prisma.unit.findMany({
    where: {
      property: { organizationId: session.user.organizationId },
      leases: { none: { status: "active" } },
    },
    include: {
      property: true,
      photos: { orderBy: { sortOrder: "asc" }, take: 1 },
      leases: {
        where: { status: { not: "active" } },
        orderBy: { endDate: "desc" },
        take: 1,
        select: { endDate: true, rentAmount: true },
      },
    },
    orderBy: [{ property: { name: "asc" } }, { unitNumber: "asc" }],
  });

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Vacancy</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {units.length === 0 ? "All units are currently occupied" : `${units.length} vacant unit${units.length > 1 ? "s" : ""}`}
        </p>
      </div>

      {units.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-xl">
          <DoorOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg">No vacancies</h3>
          <p className="text-muted-foreground text-sm mt-1">All units have active leases.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {units.map((unit) => {
            const vacantSince = unit.leases[0]?.endDate ?? unit.createdAt;
            const days = daysSince(new Date(vacantSince));
            const coverPhoto = unit.photos[0];

            return (
              <Link key={unit.id} href={`/vacancy/${unit.id}`}>
                <div className="rounded-xl border bg-card hover:border-primary/40 transition-colors overflow-hidden">
                  {/* Photo or placeholder */}
                  <div className="aspect-video bg-muted relative">
                    {coverPhoto ? (
                      <img src={coverPhoto.url} alt="Unit" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40">
                        <Camera className="h-8 w-8 mb-1" />
                        <span className="text-xs">No photos</span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge className={`text-xs border ${vacancyBadge(days)}`}>
                        Vacant {days}d
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{unit.property.name}</p>
                        <p className="text-muted-foreground text-xs">Unit {unit.unitNumber}</p>
                      </div>
                      {unit.leases[0]?.rentAmount && (
                        <p className="text-sm font-mono font-medium shrink-0">
                          {formatCurrency(Number(unit.leases[0].rentAmount))}/mo
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {unit.bedrooms != null && <span>{Number(unit.bedrooms)} bd</span>}
                      {unit.bathrooms != null && <span>{Number(unit.bathrooms)} ba</span>}
                      {unit.sqft != null && <span>{unit.sqft.toLocaleString()} sqft</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {unit.leases[0]?.endDate
                        ? `Vacant since ${new Date(unit.leases[0].endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                        : "Never leased"}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
