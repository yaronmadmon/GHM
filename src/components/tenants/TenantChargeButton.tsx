"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const CHARGE_TYPE_LABELS: Record<string, string> = {
  late_fee: "Late Fee",
  repair_chargeback: "Repair Chargeback",
  utility_reimbursement: "Utility Reimbursement",
  nsf_fee: "NSF Fee",
  returned_payment_fee: "Returned Payment Fee",
  legal_fee: "Legal Fee",
  court_fee: "Court Fee",
  attorney_fee: "Attorney Fee",
  security_deposit_deduction: "Security Deposit Deduction",
  credit: "Credit (reduces balance)",
  other: "Other",
};

const CHARGE_TYPES = Object.keys(CHARGE_TYPE_LABELS);

interface Props {
  leaseId: string;
  tenantName: string;
}

export function TenantChargeButton({ leaseId, tenantName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    chargeType: "late_fee",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount) { toast.error("Amount is required"); return; }
    setSaving(true);
    const res = await fetch("/api/tenant-charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leaseId,
        chargeType: form.chargeType,
        amount: parseFloat(form.amount),
        date: new Date(form.date).toISOString(),
        description: form.description || null,
      }),
    });
    setSaving(false);
    if (!res.ok) { toast.error("Failed to add charge"); return; }
    toast.success("Charge added to ledger");
    setOpen(false);
    setForm({ chargeType: "late_fee", amount: "", date: new Date().toISOString().split("T")[0], description: "" });
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Add Charge
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Charge — {tenantName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Charge type *</Label>
              <Select value={form.chargeType} onValueChange={(v) => setForm((f) => ({ ...f, chargeType: v ?? "other" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHARGE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{CHARGE_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ($) *</Label>
                <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="e.g. April water bill chargeback" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">
              This charge will be added to the tenant ledger immediately and affect the outstanding balance.
            </p>
            <div className="flex gap-3 pt-1">
              <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Add to Ledger"}</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
