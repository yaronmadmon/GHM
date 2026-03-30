"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Property { id: string; name: string; units: { id: string; unitNumber: string }[] }
interface Tenant { id: string; firstName: string; lastName: string }

export default function NewLeasePage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [form, setForm] = useState({
    unitId: "",
    tenantId: "",
    startDate: "",
    endDate: "",
    rentAmount: "",
    depositAmount: "",
    paymentDueDay: "1",
  });
  const [submitting, setSubmitting] = useState(false);

  const units = properties.find((p) => p.id === selectedProperty)?.units ?? [];

  useEffect(() => {
    fetch("/api/properties").then((r) => r.json()).then(setProperties).catch(() => {});
    fetch("/api/tenants").then((r) => r.json()).then(setTenants).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.unitId || !form.tenantId || !form.startDate || !form.rentAmount) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/leases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitId: form.unitId,
        tenantIds: [form.tenantId],
        startDate: form.startDate,
        endDate: form.endDate || null,
        rentAmount: parseFloat(form.rentAmount),
        depositAmount: parseFloat(form.depositAmount || "0"),
        paymentDueDay: parseInt(form.paymentDueDay),
      }),
    });
    setSubmitting(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed to create lease"); return; }
    toast.success("Lease created");
    router.push("/leases");
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">New Lease</h1>
      <Card>
        <CardHeader><CardTitle>Lease Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Property *</Label>
              <Select value={selectedProperty} onValueChange={(v) => { setSelectedProperty(v ?? ""); setForm((f) => ({ ...f, unitId: "" })); }}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Unit *</Label>
              <Select value={form.unitId} onValueChange={(v) => setForm((f) => ({ ...f, unitId: v ?? "" }))} disabled={!selectedProperty}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tenant *</Label>
              <Select value={form.tenantId} onValueChange={(v) => setForm((f) => ({ ...f, tenantId: v ?? "" }))}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>{tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date *</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date (leave blank for month-to-month)</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monthly Rent ($) *</Label>
                <Input type="number" step="0.01" placeholder="1500.00" value={form.rentAmount} onChange={(e) => setForm((f) => ({ ...f, rentAmount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Security Deposit ($)</Label>
                <Input type="number" step="0.01" placeholder="1500.00" value={form.depositAmount} onChange={(e) => setForm((f) => ({ ...f, depositAmount: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Payment Due Day of Month</Label>
              <Select value={form.paymentDueDay} onValueChange={(v) => setForm((f) => ({ ...f, paymentDueDay: v ?? "1" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Lease"}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
