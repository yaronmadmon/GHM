"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText, Loader2, Sparkles } from "lucide-react";

const NOTICE_TYPES = [
  { value: "late_fee_notice",   label: "Late Fee Notice" },
  { value: "balance_reminder",  label: "Balance Reminder" },
  { value: "renewal_offer",     label: "Lease Renewal Offer" },
  { value: "non_renewal_notice", label: "Non-Renewal Notice" },
  { value: "move_out_notice",   label: "Move-Out Instructions" },
  { value: "notice_to_enter",   label: "Notice to Enter" },
];

interface Props {
  tenantId: string;
  leaseId?: string;
  tenantName: string;
}

export function NoticeDraftButton({ tenantId, leaseId, tenantName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [noticeType, setNoticeType] = useState("late_fee_notice");
  const [draft, setDraft] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleDraft() {
    setDrafting(true);
    setDraft("");
    const res = await fetch("/api/notices/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, leaseId, noticeType }),
    });
    setDrafting(false);
    if (!res.ok) { toast.error("Draft failed"); return; }
    const { draft: text } = await res.json();
    setDraft(text);
  }

  async function handleSave() {
    if (!draft.trim()) { toast.error("Draft is empty"); return; }
    setSaving(true);
    const res = await fetch("/api/notices/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, leaseId, noticeType, noticeText: draft }),
    });
    setSaving(false);
    if (!res.ok) { toast.error("Failed to save notice"); return; }
    const { label } = await res.json();
    toast.success(`${label} saved to activity timeline`);
    setOpen(false);
    setDraft("");
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4" />
        Draft Notice
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Draft Notice — {tenantName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Notice type</Label>
              <Select value={noticeType} onValueChange={(v) => { setNoticeType(v ?? "late_fee_notice"); setDraft(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTICE_TYPES.map((n) => (
                    <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button size="sm" variant="outline" className="gap-1.5" disabled={drafting} onClick={handleDraft}>
              {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {drafting ? "Drafting…" : "Generate with AI"}
            </Button>

            {draft && (
              <div className="space-y-1.5">
                <Label>Draft — review and edit before saving</Label>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={16}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Review carefully. Saving logs this notice to the tenant&apos;s activity timeline.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              {draft && (
                <Button size="sm" disabled={saving} onClick={handleSave}>
                  {saving ? "Saving…" : "Save to Timeline"}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => { setOpen(false); setDraft(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
