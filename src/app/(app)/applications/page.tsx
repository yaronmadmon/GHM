import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, DollarSign, User } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { InviteButton } from "@/components/applications/InviteButton";
import { CopyLinkButton } from "@/components/applications/CopyLinkButton";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-900",
  documents_requested: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-900",
  under_review: "bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-300 dark:border-purple-900",
  screening: "bg-indigo-500/10 text-indigo-700 border-indigo-200 dark:text-indigo-300 dark:border-indigo-900",
  approved: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-900",
  denied: "bg-red-500/10 text-red-700 border-red-200 dark:text-red-300 dark:border-red-900",
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
    <div className="page-shell page-stack">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">Leasing</p>
          <h1 className="page-title mt-2">Applications</h1>
          <p className="mt-2 text-sm text-muted-foreground">{activeReviewCount} active review{activeReviewCount !== 1 ? "s" : ""}</p>
        </div>
        <InviteButton properties={properties} />
      </div>

      {invites.length > 0 && (
        <section className="surface-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Active invite links</h2>
            <Badge variant="secondary">{invites.length}</Badge>
          </div>
          <div className="space-y-2">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-3 rounded-md border bg-background/45 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {invite.property.name}
                    {invite.unit && <span className="text-muted-foreground"> - Unit {invite.unit.unitNumber}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{invite._count.applications} application{invite._count.applications !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="hidden rounded bg-muted px-2 py-1 text-xs sm:block">/apply/{invite.token.slice(0, 20)}...</code>
                  <CopyLinkButton path={`/apply/${invite.token}`} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {applications.length === 0 && invites.length === 0 ? (
        <div className="empty-state">
          <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="font-heading text-3xl font-semibold">No applications yet</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">Generate an invite link to start receiving applications.</p>
          <div className="mt-5">
            <InviteButton properties={properties} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {PIPELINE_STATUSES.map((status) => (
            <section key={status.value} className="min-w-0">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold">{status.label}</h2>
                <Badge variant="secondary" className="text-xs">{byStatus[status.value].length}</Badge>
              </div>
              <div className="space-y-3">
                {byStatus[status.value].length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-card/65 py-8 text-center text-sm text-muted-foreground">
                    No {status.label.toLowerCase()} applications
                  </div>
                ) : (
                  byStatus[status.value].map((application) => (
                    <Link key={application.id} href={`/applications/${application.id}`} className="block">
                      <article className="rounded-lg border bg-card p-4 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate text-sm font-semibold">{application.firstName} {application.lastName}</span>
                          </div>
                          <Badge className={`shrink-0 border text-xs ${STATUS_STYLES[application.status] ?? ""}`}>
                            {application.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {application.property.name}{application.unit ? ` - Unit ${application.unit.unitNumber}` : ""}
                        </p>
                        {application.monthlyIncome && (
                          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(Number(application.monthlyIncome))}/mo income
                          </p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">{formatDate(application.createdAt)}</p>
                      </article>
                    </Link>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
