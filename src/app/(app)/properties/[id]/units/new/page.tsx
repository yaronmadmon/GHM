"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function NewUnitPage() {
  const { id: propertyId } = useParams<{ id: string }>();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    unitNumber: "",
    bedrooms: "",
    bathrooms: "",
    status: "vacant",
    notes: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.unitNumber.trim()) { toast.error("Unit number is required"); return; }
    setSaving(true);
    const res = await fetch("/api/units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId,
        unitNumber: form.unitNumber.trim(),
        bedrooms: form.bedrooms ? parseFloat(form.bedrooms) : undefined,
        bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : undefined,
        status: form.status,
        notes: form.notes || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed to create unit"); return; }
    toast.success("Unit added");
    router.push(`/properties/${propertyId}`);
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/properties/${propertyId}`}>
          <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>
        </Link>
        <h1 className="text-xl font-semibold">Add Unit</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Unit Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Unit Number *</Label>
              <Input
                value={form.unitNumber}
                onChange={(e) => set("unitNumber", e.target.value)}
                placeholder="1A, 2, 101…"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bedrooms</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.bedrooms}
                  onChange={(e) => set("bedrooms", e.target.value)}
                  placeholder="2"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bathrooms</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.bathrooms}
                  onChange={(e) => set("bathrooms", e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v ?? "vacant")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacant">Vacant</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Corner unit, top floor…"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Saving…" : "Add Unit"}
              </Button>
              <Link href={`/properties/${propertyId}`}>
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
