"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type MonthlyCharge = {
  id: string;
  name: string;
  category: string;
  amount: number;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  notes?: string | null;
};

const CATEGORIES = [
  ["utility", "Utility"],
  ["parking", "Parking"],
  ["pet_fee", "Pet fee"],
  ["storage", "Storage"],
  ["other", "Other"],
] as const;

export function MonthlyChargesManager({
  leaseId,
  charges,
}: {
  leaseId: string;
  charges: MonthlyCharge[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "other",
    amount: "",
    startDate: "",
    endDate: "",
    notes: "",
  });

  function field(name: keyof typeof form) {
    return {
      value: form[name],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((current) => ({ ...current, [name]: event.target.value })),
    };
  }

  async function addCharge(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/leases/${leaseId}/monthly-charges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category,
          amount: Number(form.amount),
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to add monthly charge");
        return;
      }
      toast.success("Monthly charge added");
      setForm({ name: "", category: "other", amount: "", startDate: "", endDate: "", notes: "" });
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCharge(chargeId: string) {
    setDeletingId(chargeId);
    try {
      const res = await fetch(`/api/leases/${leaseId}/monthly-charges/${chargeId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete charge");
        return;
      }
      toast.success("Monthly charge removed");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add charge
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Monthly Charges</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <form onSubmit={addCharge} className="space-y-4 rounded-lg border p-4">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input {...field("name")} placeholder="Water, parking, pet fee..." required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" {...field("category")}>
                    {CATEGORIES.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Amount *</Label>
                  <Input {...field("amount")} type="number" min="0" step="0.01" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start date</Label>
                  <Input {...field("startDate")} type="date" />
                </div>
                <div className="space-y-1.5">
                  <Label>End date</Label>
                  <Input {...field("endDate")} type="date" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <textarea
                  className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                  rows={2}
                  {...field("notes")}
                />
              </div>
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? "Adding..." : "Add monthly charge"}
              </Button>
            </form>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Existing charges</p>
              {charges.length ? charges.map((charge) => (
                <div key={charge.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{charge.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{charge.category.replace("_", " ")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-semibold">${charge.amount.toFixed(2)}</p>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={deletingId === charge.id}
                      onClick={() => deleteCharge(charge.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )) : (
                <p className="rounded-lg border p-3 text-sm text-muted-foreground">No additional monthly charges yet.</p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
