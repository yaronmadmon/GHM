"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, Clock, Plus, Trash2, Wrench } from "lucide-react";
import { formatDate } from "@/lib/utils";

export type WorkOrderRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  estimatedCost: number | null;
  actualCost: number | null;
  vendorId: string | null;
  propertyId: string | null;
  scheduledDate: string | null;
  completedDate: string | null;
  transactionId: string | null;
  notes: string | null;
  createdAt: string;
};

type Property = { id: string; name: string };
type Vendor = { id: string; name: string };

const STATUS_FLOW = ["new", "assigned", "waiting_estimate", "approved", "in_progress", "completed", "invoiced", "cancelled"];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-700 border-blue-200",
  assigned: "bg-purple-500/10 text-purple-700 border-purple-200",
  waiting_estimate: "bg-amber-500/10 text-amber-700 border-amber-200",
  approved: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  in_progress: "bg-orange-500/10 text-orange-700 border-orange-200",
  completed: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  invoiced: "bg-blue-500/10 text-blue-700 border-blue-200",
  cancelled: "bg-muted text-muted-foreground",
};

function formatCurrency(n: number | null) {
  if (n == null) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

interface Props { initialOrders: WorkOrderRow[]; properties: Property[]; vendors: Vendor[]; }

export function WorkOrdersClient({ initialOrders, properties, vendors }: Props) {
  const [orders, setOrders] = useState<WorkOrderRow[]>(initialOrders);
  const [filter, setFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", propertyId: "", vendorId: "", estimatedCost: "", scheduledDate: "", notes: "" });
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = filter === "all" ? orders : filter === "active" ? orders.filter(o => !["completed","cancelled","invoiced"].includes(o.status)) : orders.filter(o => o.status === filter);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setCreating(true);
    const res = await fetch("/api/work-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title, propertyId: form.propertyId || null, vendorId: form.vendorId || null, estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : null, scheduledDate: form.scheduledDate ? new Date(form.scheduledDate).toISOString() : null, notes: form.notes || null }),
    });
    setCreating(false);
    if (!res.ok) { toast.error("Failed to create work order"); return; }
    const wo = await res.json();
    setOrders(prev => [wo, ...prev]);
    setDialogOpen(false);
    setForm({ title: "", propertyId: "", vendorId: "", estimatedCost: "", scheduledDate: "", notes: "" });
    toast.success("Work order created");
  }

  async function advance(wo: WorkOrderRow) {
    const idx = STATUS_FLOW.indexOf(wo.status);
    if (idx >= STATUS_FLOW.length - 2) return;
    const next = STATUS_FLOW[idx + 1];
    setActionLoading(wo.id);
    const res = await fetch(`/api/work-orders/${wo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    setActionLoading(null);
    if (!res.ok) { toast.error("Failed to update"); return; }
    const updated = await res.json();
    setOrders(prev => prev.map(o => o.id === wo.id ? updated : o));
    toast.success(`Status → ${next.replace(/_/g, " ")}`);
  }

  async function handleDelete(id: string) {
    setActionLoading(id);
    const res = await fetch(`/api/work-orders/${id}`, { method: "DELETE" });
    setActionLoading(null);
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error((d as {error?:string}).error ?? "Failed to delete"); return; }
    setOrders(prev => prev.filter(o => o.id !== id));
    toast.success("Deleted");
  }

  const openCount = orders.filter(o => !["completed","cancelled","invoiced"].includes(o.status)).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Work Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{openCount} active · {orders.length} total</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> New Work Order
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["all","active","new","in_progress","waiting_estimate","completed"].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
            {f === "all" ? "All" : f === "active" ? "Active" : f.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><Wrench className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" /><p className="text-sm font-medium">{orders.length === 0 ? "No work orders yet" : "No work orders match this filter"}</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(wo => (
            <Card key={wo.id}>
              <CardContent className="flex items-start gap-4 py-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{wo.title}</span>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[wo.status] ?? ""}`}>
                      {wo.status.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
                    </Badge>
                    {wo.transactionId && <span className="text-xs text-emerald-600">Expense recorded</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {wo.estimatedCost != null && <span>Est. {formatCurrency(wo.estimatedCost)}</span>}
                    {wo.actualCost != null && <span>Actual {formatCurrency(wo.actualCost)}</span>}
                    {wo.scheduledDate && <span>Scheduled {formatDate(new Date(wo.scheduledDate))}</span>}
                    {wo.completedDate && <span className="text-emerald-600">Completed {formatDate(new Date(wo.completedDate))}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {!["completed","invoiced","cancelled"].includes(wo.status) && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={actionLoading === wo.id} onClick={() => advance(wo)}>
                      {wo.status === "in_progress" ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> : <Clock className="h-3.5 w-3.5 mr-1" />}
                      Advance
                    </Button>
                  )}
                  {!["completed","invoiced"].includes(wo.status) && (
                    <button onClick={() => handleDelete(wo.id)} disabled={actionLoading === wo.id} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Work Order</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Title *</Label><Input placeholder="e.g. Replace HVAC unit" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Property</Label>
                <Select value={form.propertyId} onValueChange={v=>setForm(f=>({...f,propertyId:v??""}))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="">None</SelectItem>{properties.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>Vendor</Label>
                <Select value={form.vendorId} onValueChange={v=>setForm(f=>({...f,vendorId:v??""}))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="">None</SelectItem>{vendors.map(v=><SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Est. Cost ($)</Label><Input type="number" step="0.01" min="0" placeholder="0.00" value={form.estimatedCost} onChange={e=>setForm(f=>({...f,estimatedCost:e.target.value}))} /></div>
              <div className="space-y-1.5"><Label>Scheduled Date</Label><Input type="date" value={form.scheduledDate} onChange={e=>setForm(f=>({...f,scheduledDate:e.target.value}))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input placeholder="Optional notes" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
            <div className="flex gap-3 pt-1"><Button type="submit" size="sm" disabled={creating}>{creating?"Saving…":"Create"}</Button><Button type="button" variant="outline" size="sm" onClick={()=>setDialogOpen(false)}>Cancel</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
