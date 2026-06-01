"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClipboardList, Plus, Printer } from "lucide-react";
import { formatDate } from "@/lib/utils";

export type InspectionRow = {
  id: string;
  propertyId: string;
  unitId: string | null;
  leaseId: string | null;
  tenantId: string | null;
  inspectionType: string;
  status: string;
  scheduledDate: string | null;
  completedDate: string | null;
  overallCondition: string | null;
  notes: string | null;
  checklist: unknown;
  createdAt: string;
};

type Property = { id: string; name: string };

const TYPE_LABELS: Record<string, string> = { move_in: "Move-In", move_out: "Move-Out", annual: "Annual", maintenance: "Maintenance" };
const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-700 border-blue-200",
  in_progress: "bg-amber-500/10 text-amber-700 border-amber-200",
  completed: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  cancelled: "bg-muted text-muted-foreground",
};
const CONDITION_COLORS: Record<string, string> = {
  excellent: "text-emerald-700", good: "text-emerald-600", fair: "text-amber-700", poor: "text-destructive"
};

interface Props { initialInspections: InspectionRow[]; properties: Property[]; }

export function InspectionsClient({ initialInspections, properties }: Props) {
  const router = useRouter();
  const [inspections, setInspections] = useState<InspectionRow[]>(initialInspections);
  const [filter, setFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ propertyId: "", inspectionType: "move_in", scheduledDate: "", notes: "" });
  const [creating, setCreating] = useState(false);
  const [advancing, setAdvancing] = useState<string | null>(null);

  const filtered = filter === "all" ? inspections : inspections.filter(i => i.status === filter || i.inspectionType === filter);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.propertyId) { toast.error("Property is required"); return; }
    setCreating(true);
    const res = await fetch("/api/inspections", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: form.propertyId, inspectionType: form.inspectionType, scheduledDate: form.scheduledDate ? new Date(form.scheduledDate).toISOString() : null, notes: form.notes || null }),
    });
    setCreating(false);
    if (!res.ok) { toast.error("Failed to create inspection"); return; }
    const insp = await res.json();
    setInspections(prev => [insp, ...prev]);
    setDialogOpen(false);
    setForm({ propertyId: "", inspectionType: "move_in", scheduledDate: "", notes: "" });
    toast.success("Inspection scheduled");
  }

  async function markComplete(insp: InspectionRow, condition: string) {
    setAdvancing(insp.id);
    const res = await fetch(`/api/inspections/${insp.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", overallCondition: condition }),
    });
    setAdvancing(null);
    if (!res.ok) { toast.error("Failed to update"); return; }
    const updated = await res.json();
    setInspections(prev => prev.map(i => i.id === insp.id ? updated : i));
    toast.success("Inspection completed");
  }

  async function startInspection(insp: InspectionRow) {
    setAdvancing(insp.id);
    const res = await fetch(`/api/inspections/${insp.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress" }),
    });
    setAdvancing(null);
    if (!res.ok) { toast.error("Failed to update"); return; }
    const updated = await res.json();
    setInspections(prev => prev.map(i => i.id === insp.id ? updated : i));
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inspections</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {inspections.filter(i => i.status !== "completed" && i.status !== "cancelled").length} scheduled · {inspections.filter(i=>i.status==="completed").length} completed
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Schedule Inspection
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["all","scheduled","in_progress","completed","move_in","move_out","annual"].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filter===f?"bg-primary text-primary-foreground border-primary":"border-border text-muted-foreground hover:border-primary/40"}`}>
            {f==="all"?"All":f.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><ClipboardList className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" /><p className="text-sm font-medium">{inspections.length===0?"No inspections yet":"No inspections match this filter"}</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(insp => {
            const propName = properties.find(p=>p.id===insp.propertyId)?.name ?? "Unknown property";
            return (
              <Card key={insp.id}>
                <CardContent className="flex items-start gap-4 py-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{TYPE_LABELS[insp.inspectionType] ?? insp.inspectionType} Inspection</span>
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[insp.status]??""}`}>
                        {insp.status.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
                      </Badge>
                      {insp.overallCondition && (
                        <span className={`text-xs font-medium capitalize ${CONDITION_COLORS[insp.overallCondition]??""}`}>{insp.overallCondition}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{propName}</span>
                      {insp.scheduledDate && <span>Scheduled {formatDate(new Date(insp.scheduledDate))}</span>}
                      {insp.completedDate && <span className="text-emerald-600">Completed {formatDate(new Date(insp.completedDate))}</span>}
                    </div>
                    {insp.notes && <p className="text-xs text-muted-foreground">{insp.notes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {insp.status === "scheduled" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={advancing===insp.id} onClick={() => startInspection(insp)}>Start</Button>
                    )}
                    {insp.status === "in_progress" && (
                      <>
                        {["good","fair","poor"].map(c => (
                          <Button key={c} size="sm" variant="outline" className="h-7 text-xs capitalize" disabled={advancing===insp.id} onClick={() => markComplete(insp, c)}>{c}</Button>
                        ))}
                      </>
                    )}
                    {insp.status === "completed" && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => window.print()}>
                        <Printer className="h-3.5 w-3.5" /> Print
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Schedule Inspection</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Property *</Label>
              <Select value={form.propertyId} onValueChange={v=>setForm(f=>({...f,propertyId:v??""}))}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{properties.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Type *</Label>
              <Select value={form.inspectionType} onValueChange={v=>setForm(f=>({...f,inspectionType:v??"move_in"}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPE_LABELS).map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Scheduled Date</Label><Input type="date" value={form.scheduledDate} onChange={e=>setForm(f=>({...f,scheduledDate:e.target.value}))} /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Input placeholder="Optional" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
            <div className="flex gap-3 pt-1"><Button type="submit" size="sm" disabled={creating}>{creating?"Saving…":"Schedule"}</Button><Button type="button" variant="outline" size="sm" onClick={()=>setDialogOpen(false)}>Cancel</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
