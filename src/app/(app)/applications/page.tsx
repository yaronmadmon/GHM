import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Plus, User, DollarSign, Copy } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { InviteButton } from "@/components/applications/InviteButton";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 border-amber-200",
  approved: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  denied: "bg-red-500/10 text-red-600 border-red-200",
};

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [applications, invites, properties] = await Promise.all([
    prisma.application.findMany({
      where: { organizationId: session.user.organizationId },
      include: { property: true, unit: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.applicationInvite.findMany({
      where: { organizationId: session.user.organizationId, isActive: true },
      include: { property: true, unit: true, _count: { select: { applications: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.property.findMany({
      where: { organizationId: session.user.organizationId, archivedAt: null },
      include: { units: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const byStatus = { pending: applications.filter((a) => a.status === "pending"), approved: applications.filter((a) => a.status === "approved"), denied: applications.filter((a) => a.status === "denied") };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Applications</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{byStatus.pending.length} pending review</p>
        </div>
        <InviteButton properties={properties} />
      </div>

      {/* Active Invite Links */}
      {invites.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Active invite links</h2>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                <div>
                  <span className="font-medium">{inv.property.name}</span>
                  {inv.unit && <span className="text-muted-foreground ml-1">· Unit {inv.unit.unitNumber}</span>}
                  <span className="text-muted-foreground ml-2">· {inv._count.applications} applications</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded">{`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/apply/${inv.token}`.slice(0, 50)}…</code>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                    <Copy className="h-3 w-3" />Copy
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(["pending", "approved", "denied"] as const).map((status) => (
          <div key={status}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold capitalize">{status}</h2>
              <Badge variant="secondary" className="text-xs">{byStatus[status].length}</Badge>
            </div>
            <div className="space-y-3">
              {byStatus[status].length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                  No {status} applications
                </div>
              ) : (
                byStatus[status].map((app) => (
                  <Link key={app.id} href={`/applications/${app.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{app.firstName} {app.lastName}</span>
                          </div>
                          <Badge className={`text-xs border ${STATUS_STYLES[app.status] ?? ""}`}>{app.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{app.property.name}{app.unit ? ` · Unit ${app.unit.unitNumber}` : ""}</p>
                        {app.monthlyIncome && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(Number(app.monthlyIncome))}/mo income
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">{formatDate(app.createdAt)}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {applications.length === 0 && invites.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-xl">
          <ClipboardList className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg">No applications yet</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Generate an invite link to start receiving applications</p>
          <InviteButton properties={properties} />
        </div>
      )}
    </div>
  );
}
