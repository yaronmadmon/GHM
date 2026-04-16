import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, Plus, MessageSquare, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

const PRIORITY_STYLES: Record<string, string> = {
  emergency: "bg-red-500 text-white",
  high: "bg-orange-500/10 text-orange-700 border-orange-200",
  medium: "bg-amber-500/10 text-amber-700 border-amber-200",
  low: "bg-muted text-muted-foreground",
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-700 border-blue-200",
  in_progress: "bg-amber-500/10 text-amber-700 border-amber-200",
  pending_parts: "bg-purple-500/10 text-purple-700 border-purple-200",
  completed: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  cancelled: "bg-muted text-muted-foreground",
};

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ property?: string }> }) {
  const session = await auth();
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

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Maintenance</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {requests.filter((r) => r.status !== "completed").length} open requests
          </p>
        </div>
        <Link href="/maintenance/new">
          <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />New</Button>
        </Link>
      </div>

      {propertyFilter && requests[0] && (
        <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2">
          <span className="text-muted-foreground">Filtered by property:</span>
          <span className="font-medium">{requests[0].property.name}</span>
          <Link href="/maintenance" className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </Link>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-xl">
          <Wrench className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg">No maintenance requests</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Log your first maintenance issue</p>
          <Link href="/maintenance/new"><Button size="sm"><Plus className="h-4 w-4 mr-2" />New request</Button></Link>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {requests.map((r) => (
              <Link key={r.id} href={`/maintenance/${r.id}`}>
                <div className="rounded-lg border p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.property.name}{r.unit ? ` · ${r.unit.unitNumber}` : ""}</p>
                    </div>
                    <Badge className={`text-xs border shrink-0 ${PRIORITY_STYLES[r.priority] ?? ""}`}>{r.priority}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={`text-xs border ${STATUS_STYLES[r.status] ?? ""}`}>{r.status.replace("_", " ")}</Badge>
                    {r.assignedVendor && <span className="text-xs text-muted-foreground">{r.assignedVendor.name}</span>}
                    {r._count.comments > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                        <MessageSquare className="h-3 w-3" />{r._count.comments}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">{formatDate(r.createdAt)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Issue</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Property</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vendor</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/maintenance/${r.id}`} className="font-medium hover:text-primary">{r.title}</Link>
                      {r.category && <p className="text-xs text-muted-foreground capitalize">{r.category}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <Link href={`/properties/${r.property.id}`} className="hover:text-primary transition-colors">
                        {r.property.name}
                      </Link>
                      {r.unit ? ` · ${r.unit.unitNumber}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs border ${PRIORITY_STYLES[r.priority] ?? ""}`}>{r.priority}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs border ${STATUS_STYLES[r.status] ?? ""}`}>{r.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{r.assignedVendor?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs flex items-center gap-1">
                      {r._count.comments > 0 && <><MessageSquare className="h-3.5 w-3.5" />{r._count.comments}</>}
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
