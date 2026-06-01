import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Plus, Wrench, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

const PRIORITY_STYLES: Record<string, string> = {
  emergency: "bg-red-600 text-white border-red-600",
  high: "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-900",
  medium: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-900",
  low: "bg-muted text-muted-foreground",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-900",
  in_progress: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-900",
  pending_parts: "bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-300 dark:border-purple-900",
  completed: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-900",
  cancelled: "bg-muted text-muted-foreground",
};

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ property?: string }> }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const { property: propertyFilter } = await searchParams;

  const requests = await prisma.maintenanceRequest.findMany({
    where: {
      organizationId: session.user.organizationId,
      status: { not: "cancelled" },
      ...(propertyFilter ? { propertyId: propertyFilter } : {}),
    },
    include: {
      property: true,
      unit: true,
      assignedVendor: true,
      _count: { select: { comments: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  const openCount = requests.filter((request) => request.status !== "completed").length;

  return (
    <div className="page-shell page-stack">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">Operations</p>
          <h1 className="page-title mt-2">Maintenance</h1>
          <p className="mt-2 text-sm text-muted-foreground">{openCount} open request{openCount !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/maintenance/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New request
          </Button>
        </Link>
      </div>

      {propertyFilter && requests[0] && (
        <div className="surface-panel flex items-center gap-2 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Filtered by property:</span>
          <span className="font-medium">{requests[0].property.name}</span>
          <Link href="/maintenance" className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Clear property filter">
            <X className="h-4 w-4" />
          </Link>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="empty-state">
          <Wrench className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="font-heading text-3xl font-semibold">No maintenance requests</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">Log repair requests and vendor follow-up from one operations queue.</p>
          <Link href="/maintenance/new" className="mt-5">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New request
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {requests.map((request) => (
              <Link key={request.id} href={`/maintenance/${request.id}`} className="block">
                <article className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{request.title}</p>
                      <p className="text-xs text-muted-foreground">{request.property.name}{request.unit ? ` - ${request.unit.unitNumber}` : ""}</p>
                    </div>
                    <Badge className={`shrink-0 border text-xs ${PRIORITY_STYLES[request.priority] ?? ""}`}>{request.priority}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge className={`border text-xs ${STATUS_STYLES[request.status] ?? ""}`}>{request.status.replace("_", " ")}</Badge>
                    {request.assignedVendor && <span className="text-xs text-muted-foreground">{request.assignedVendor.name}</span>}
                    {request._count.comments > 0 && (
                      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        {request._count.comments}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">{formatDate(request.createdAt)}</span>
                  </div>
                </article>
              </Link>
            ))}
          </div>

          <div className="data-table-shell hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Issue</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Property</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Priority</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {requests.map((request) => (
                  <tr key={request.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/maintenance/${request.id}`} className="font-medium hover:text-primary">{request.title}</Link>
                      {request.category && <p className="text-xs capitalize text-muted-foreground">{request.category}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <Link href={`/properties/${request.property.id}`} className="hover:text-primary">
                        {request.property.name}
                      </Link>
                      {request.unit ? ` - ${request.unit.unitNumber}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`border text-xs ${PRIORITY_STYLES[request.priority] ?? ""}`}>{request.priority}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`border text-xs ${STATUS_STYLES[request.status] ?? ""}`}>{request.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{request.assignedVendor?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(request.createdAt)}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {request._count.comments > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {request._count.comments}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
