"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";

const CHECKLIST_ITEMS = [
  "Keys handed over to tenant",
  "Utilities transferred to tenant's name",
  "Security deposit received and documented",
  "Move-in photos taken (all rooms)",
  "Inspection checklist reviewed with tenant",
  "Tenant portal access confirmed (can log in)",
];

interface Props {
  leaseId: string;
  onComplete: () => void;
}

export function MoveInChecklist({ leaseId, onComplete }: Props) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const allChecked = checked.size === CHECKLIST_ITEMS.length;

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function handleConfirm() {
    setConfirming(true);
    const res = await fetch(`/api/leases/${leaseId}/move-in`, { method: "POST" });
    setConfirming(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed to confirm"); return; }
    toast.success("Move-in confirmed! Tenant is now active.");
    onComplete();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Check all items before confirming move-in.</p>
      <div className="space-y-2">
        {CHECKLIST_ITEMS.map((item, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className="w-full flex items-center gap-3 text-left p-3 rounded-lg border hover:bg-muted/30 transition-colors"
          >
            {checked.has(i)
              ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              : <Circle className="h-5 w-5 text-muted-foreground/50 shrink-0" />}
            <span className={`text-sm ${checked.has(i) ? "line-through text-muted-foreground" : ""}`}>{item}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button
          onClick={handleConfirm}
          disabled={!allChecked || confirming}
          className="gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          {confirming ? "Confirming..." : "Confirm Move-in"}
        </Button>
        {!allChecked && (
          <p className="text-xs text-muted-foreground">
            {CHECKLIST_ITEMS.length - checked.size} item{CHECKLIST_ITEMS.length - checked.size !== 1 ? "s" : ""} remaining
          </p>
        )}
      </div>
    </div>
  );
}
