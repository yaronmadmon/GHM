"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DoorOpen } from "lucide-react";

interface Props {
  leaseId: string;
  tenantName: string;
  currentMoveOutDate?: string | null;
}

export function MoveOutButton({ leaseId, tenantName, currentMoveOutDate }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    moveOutDate: currentMoveOutDate
      ? new Date(currentMoveOutDate).toISOString().split("T")[0]
      : "",
    moveOutNoticedAt: "",
    notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.moveOutDate) { toast.error("Move-out date is required"); return; }
    setSaving(true);
    const res = await fetch(`/api/leases/${leaseId}/move-out`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moveOutDate: new Date(form.moveOutDate).toISOString(),
        moveOutNoticedAt: form.moveOutNoticedAt
          ? new Date(form.moveOutNoticedAt).toISOString()
          : null,
        notes: form.notes || null,
      }),
    });
    setSaving(false);
    if (!res.ok) { toast.error("Failed to record move-out"); return; }
    toast.success("Move-out recorded — task created");
    setOpen(false);
    router.refresh();
  }

  const label = currentMoveOutDate ? "Update Move-Out" : "Record Move-Out";

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <DoorOpen className="h-4 w-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{label} — {tenantName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Notice given date</Label>
              <Input
                type="date"
                value={form.moveOutNoticedAt}
                onChange={(e) => setForm((f) => ({ ...f, moveOutNoticedAt: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Move-out date *</Label>
              <Input
                type="date"
                required
                value={form.moveOutDate}
                onChange={(e) => setForm((f) => ({ ...f, moveOutDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                placeholder="e.g. Tenant leaving for job relocation"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Recording a move-out will create a follow-up task and log the event to the activity timeline. If the move-out date is today or in the past, the unit will be marked vacant.
            </p>
            <div className="flex gap-3 pt-1">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving…" : "Record Move-Out"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
