import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Plus, MapPin } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  occupied: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  vacant: "bg-amber-500/10 text-amber-600 border-amber-200",
  under_maintenance: "bg-red-500/10 text-red-600 border-red-200",
};

export default async function PropertiesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const properties = await prisma.property.findMany({
    where: { organizationId: session.user.organizationId, archivedAt: null },
    include: {
      units: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Properties</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{properties.length} properties</p>
        </div>
        <Link href="/properties/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add property
          </Button>
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-xl">
          <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg">No properties yet</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Add your first property to get started</p>
          <Link href="/properties/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add property
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {properties.map((property) => {
            const total = property.units.length;
            const occupied = property.units.filter((u) => u.status === "occupied").length;
            const vacant = total - occupied;
            return (
              <Link key={property.id} href={`/properties/${property.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-snug">{property.name}</h3>
                      <Badge className={`text-xs border shrink-0 ${STATUS_COLORS[property.status] ?? ""}`}>
                        {property.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-start gap-1">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {property.addressLine1}, {property.city}, {property.state} {property.zip}
                    </p>
                    <div className="flex items-center gap-3 text-sm pt-1 border-t">
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{total}</span> unit{total !== 1 ? "s" : ""}
                      </span>
                      <span className="text-emerald-600">
                        <span className="font-medium">{occupied}</span> occupied
                      </span>
                      {vacant > 0 && (
                        <span className="text-amber-600">
                          <span className="font-medium">{vacant}</span> vacant
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
