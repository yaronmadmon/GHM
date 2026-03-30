"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, Plus } from "lucide-react";
import { toast } from "sonner";

interface MaintenanceRequest {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  description?: string;
  createdAt: string;
}

const PRIORITY_COLORS: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  emergency: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
};

export default function PortalMaintenancePage() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [form, setForm] = useState({ title: "", category: "plumbing", priority: "medium", description: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/portal/maintenance")
      .then((r) => r.json())
      .then((d) => {
        setRequests(d.requests ?? []);
        setUnitId(d.unitId ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function submit() {
    if (!unitId) { toast.error("No active unit found"); return; }
    setSubmitting(true);
    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, unitId }),
    });
    setSubmitting(false);
    if (!res.ok) { toast.error("Failed to submit"); return; }
    const req = await res.json();
    setRequests((prev) => [req, ...prev]);
    setOpen(false);
    setForm({ title: "", category: "plumbing", priority: "medium", description: "" });
    toast.success("Request submitted");
  }

  if (loading) return <div className="p-4 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Maintenance</h1>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Request
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> My Requests</CardTitle></CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No maintenance requests yet.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div key={r.id} className="flex items-start justify-between py-3 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{r.category}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={PRIORITY_COLORS[r.priority] ?? "secondary"} className="text-xs">{r.priority}</Badge>
                    <Badge variant="outline" className="text-xs capitalize">{r.status.replace("_", " ")}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Maintenance Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Leaking faucet in bathroom" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? "plumbing" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["plumbing","electrical","hvac","appliance","structural","pest","other"].map((c) => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v ?? "medium" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low","medium","high","emergency"].map((p) => (
                      <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe the issue..." />
            </div>
            <Button onClick={submit} disabled={submitting || !form.title} className="w-full">
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
