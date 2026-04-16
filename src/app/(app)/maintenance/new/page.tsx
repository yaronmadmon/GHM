"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface Property { id: string; name: string; units: { id: string; unitNumber: string }[] }
interface Vendor { id: string; name: string; trade?: string }

const CATEGORIES = ["plumbing", "electrical", "hvac", "appliance", "structural", "other"];
const PRIORITIES = ["low", "medium", "high", "emergency"];

export default function NewMaintenancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedProperty, setSelectedProperty] = useState(searchParams.get("propertyId") ?? "");
  const [form, setForm] = useState({
    unitId: searchParams.get("unitId") ?? "",
    title: "",
    description: "",
    priority: "medium",
    category: "",
    assignedVendorId: "",
    estimatedCost: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const units = properties.find((p) => p.id === selectedProperty)?.units ?? [];

  useEffect(() => {
    fetch("/api/properties").then((r) => r.json()).then(setProperties).catch(() => {});
    fetch("/api/vendors").then((r) => r.json()).then(setVendors).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProperty || !form.title || !form.description) {
      toast.error("Property, title, and description are required");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: selectedProperty,
        unitId: form.unitId || undefined,
        title: form.title,
        description: form.description,
        priority: form.priority,
        category: form.category || undefined,
        assignedVendorId: form.assignedVendorId || undefined,
        estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error ?? "Failed to create request");
      return;
    }
    const data = await res.json();
    toast.success("Maintenance request created");
    router.push(`/maintenance/${data.id}`);
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/maintenance">
          <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold">New Maintenance Request</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Request Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Property *</Label>
                <Select
                  value={selectedProperty}
                  onValueChange={(v) => { setSelectedProperty(v ?? ""); setForm((f) => ({ ...f, unitId: "" })); }}
                >
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Unit (optional)</Label>
                <Select
                  value={form.unitId}
                  onValueChange={(v) => setForm((f) => ({ ...f, unitId: v ?? "" }))}
                  disabled={!selectedProperty || units.length === 0}
                >
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Issue Title *</Label>
              <Input
                placeholder="e.g. Leaking faucet in kitchen"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Textarea
                placeholder="Describe the issue in detail..."
                rows={4}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v ?? "medium" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}><span className="capitalize">{p}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}><span className="capitalize">{c}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Assign Vendor (optional)</Label>
                <Select value={form.assignedVendorId} onValueChange={(v) => setForm((f) => ({ ...f, assignedVendorId: v ?? "" }))}>
                  <SelectTrigger><SelectValue placeholder="No vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}{v.trade ? ` · ${v.trade}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Estimated Cost ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.estimatedCost}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedCost: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Request"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
