"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started", color: "bg-muted text-muted-foreground" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "passed", label: "Passed", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "conditional", label: "Conditional", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "failed", label: "Failed", color: "bg-red-100 text-red-700 border-red-200" },
];

interface Props {
  applicationId: string;
  initialStatus?: string | null;
  initialNotes?: string | null;
  initialDate?: string | null;
  onChange?: (status: string) => void;
}

export function ScreeningSection({ applicationId, initialStatus, initialNotes, initialDate, onChange }: Props) {
  const [status, setStatus] = useState(initialStatus ?? "not_started");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [date, setDate] = useState(initialDate ? initialDate.split("T")[0] : "");
  const [saving, setSaving] = useState(false);

  const statusMeta = STATUS_OPTIONS.find((s) => s.value === status);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        backgroundCheckStatus: status,
        backgroundCheckNotes: notes || null,
        backgroundCheckDate: date || null,
      }),
    });
    setSaving(false);
    if (!res.ok) { toast.error("Failed to save"); return; }
    toast.success("Screening updated");
    onChange?.(status);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Current status:</span>
        <Badge className={`border text-xs ${statusMeta?.color ?? "bg-muted"}`}>{statusMeta?.label ?? status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Screening Result</Label>
          <Select value={status} onValueChange={(v) => { setStatus(v ?? "not_started"); }}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Screening Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-sm" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Background check provider, reference contact results, income verification notes..."
          rows={2}
          className="text-sm resize-none"
        />
      </div>

      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Screening"}
      </Button>
    </div>
  );
}
