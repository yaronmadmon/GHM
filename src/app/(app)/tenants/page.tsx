import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Plus, Mail, Phone } from "lucide-react";
import { getInitials } from "@/lib/utils";

export default async function TenantsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tenants = await prisma.tenant.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      leaseLinks: {
        include: { lease: { where: { status: "active" }, include: { unit: { include: { property: true } } } } },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tenants</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{tenants.length} tenants</p>
        </div>
        <Link href="/tenants/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add tenant
          </Button>
        </Link>
      </div>

      {tenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-xl">
          <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg">No tenants yet</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Add tenants and link them to leases</p>
          <Link href="/tenants/new">
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add tenant</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tenants.map((tenant) => {
            const activeLease = tenant.leaseLinks.find((l) => l.lease?.status === "active")?.lease;
            return (
              <Link key={tenant.id} href={`/tenants/${tenant.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary shrink-0">
                      {getInitials(`${tenant.firstName} ${tenant.lastName}`)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{tenant.firstName} {tenant.lastName}</h3>
                        {activeLease ? (
                          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">No lease</Badge>
                        )}
                      </div>
                      {activeLease && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {activeLease.unit.property.name} · Unit {activeLease.unit.unitNumber}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {tenant.email && (
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{tenant.email}</span>
                        )}
                        {tenant.phone && (
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{tenant.phone}</span>
                        )}
                      </div>
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
