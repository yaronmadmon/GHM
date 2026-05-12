import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Plus, User, DollarSign } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { InviteButton } from "@/components/applications/InviteButton";
import { CopyLinkButton } from "@/components/applications/CopyLinkButton";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 border-amber-200",
  documents_requested: "bg-blue-500/10 text-blue-700 border-blue-200",
  under_review: "bg-purple-500/10 text-purple-700 border-purple-200",
  screening: "bg-indigo-500/10 text-indigo-700 border-indigo-200",
  approved: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  denied: "bg-red-500/10 text-red-600 border-red-200",
};

const PIPELINE_STATUSES = [
  { value: "pending", label: "Submitted" },
  { value: "documents_requested", label: "Docs Requested" },
  { value: "under_review", label: "Under Review" },
  { value: "screening", label: "Screening" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
] as const;

export default async function ApplicationsPage() {
  const session = await getSession();
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

  const byStatus = Object.fromEntries(
    PIPELINE_STATUSES.map((status) => [
      status.value,
      applications.filter((application) => application.status === status.value),
    ])
  ) as Record<(typeof PIPELINE_STATUSES)[number]["value"], typeof applications>;
  const activeReviewCount = applications.filter((application) => !["approved", "denied"].includes(application.status)).length;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Applications</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{activeReviewCount} active review</p>
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
                  <code className="text-xs bg-muted px-2 py-1 rounded hidden sm:block">/apply/{inv.token.slice(0, 20)}…</code>
                  <CopyLinkButton path={`/apply/${inv.token}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {PIPELINE_STATUSES.map((status) => (
          <div key={status.value}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold">{status.label}</h2>
              <Badge variant="secondary" className="text-xs">{byStatus[status.value].length}</Badge>
            </div>
            <div className="space-y-3">
              {byStatus[status.value].length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                  No {status.label.toLowerCase()} applications
                </div>
              ) : (
                byStatus[status.value].map((app) => (
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
