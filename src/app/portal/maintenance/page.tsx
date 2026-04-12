"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Wrench, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 border-amber-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  resolved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  closed: "bg-muted text-muted-foreground",
};

const PRIORITY_STYLES: Record<string, string> = {
  emergency: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-muted text-muted-foreground",
};

export default function PortalMaintenancePage() {
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/portal/maintenance")
      .then((r) => {
        if (r.status === 401) { router.push("/portal/login"); return null; }
        return r.json();
      })
      .then((d) => d && setRequests(Array.isArray(d) ? d : []))
      .catch(() => router.push("/portal/login"));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/portal/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSubmitting(false);
    if (!res.ok) { toast.error("Failed to submit request"); return; }
    const req = await res.json();
    setRequests((prev) => [req, ...prev]);
    setForm({ title: "", description: "", priority: "medium" });
    setShowForm(false);
    toast.success("Maintenance request submitted!");
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/portal">
            <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>
          </Link>
          <h1 className="font-semibold flex-1">Maintenance</h1>
          <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />New Request
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {showForm && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Submit a Request</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">What needs attention?</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Leaking faucet in kitchen"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Details (optional)</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Describe the issue..."
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v ?? "medium" }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={submitting}>{submitting ? "Submitting..." : "Submit"}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4" />Your Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No maintenance requests yet.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div key={r.id} className="border rounded-lg p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm">{r.title}</p>
                      <Badge className={`border text-xs shrink-0 ${STATUS_STYLES[r.status] ?? ""}`}>{r.status.replace("_", " ")}</Badge>
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                    <div className="flex items-center gap-2">
                      <Badge className={`border text-xs ${PRIORITY_STYLES[r.priority] ?? ""}`}>{r.priority}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(new Date(r.createdAt))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
