import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, Plus, MessageSquare } from "lucide-react";
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

export default async function MaintenancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const requests = await prisma.maintenanceRequest.findMany({
    where: { organizationId: session.user.organizationId, status: { not: "cancelled" } },
    include: {
      property: true,
      unit: true,
      assignedVendor: true,
      _count: { select: { comments: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Maintenance</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{requests.filter((r) => r.status !== "completed").length} open requests</p>
        </div>
        <Link href="/maintenance/new">
          <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />New request</Button>
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-xl">
          <Wrench className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg">No maintenance requests</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Log your first maintenance issue</p>
          <Link href="/maintenance/new"><Button size="sm"><Plus className="h-4 w-4 mr-2" />New request</Button></Link>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
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
                    {r.property.name}{r.unit ? ` · ${r.unit.unitNumber}` : ""}
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
      )}
    </div>
  );
}
