"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sparkles, Upload, CheckCircle, AlertTriangle,
  Trash2, ChevronRight, ArrowRight, Pencil, Check, X,
} from "lucide-react";
import { toast } from "sonner";
import { useMigrationContext } from "@/contexts/MigrationContext";
import type { ExtractedTenant } from "@/app/api/import/smart/route";

type CommitPhase = "review" | "importing" | "done";

interface DoneStats {
  tenants: number;
  properties: number;
  leases: number;
  payments: number;
  skipped: number;
  errors: string[];
}

const CHUNK_SIZE = 15;
const ACCEPTED = ".csv,.xlsx,.pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff,.tif";

const PROGRESS_MESSAGES = [
  "Uploading your document…",
  "Reading the document…",
  "Extracting tenant data…",
  "Checking for details…",
  "Almost ready…",
];

// ─── Inline editable field ────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = "text", placeholder = "—", mono = false,
}: {
  label: string;
  value: string | number | undefined | null;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  mono?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEdit() { setDraft(value != null ? String(value) : ""); setEditing(true); }
  function commit() { onChange(draft); setEditing(false); }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus type={type} value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            className="text-sm border-b border-primary bg-primary/5 outline-none px-1 py-0.5 rounded-sm w-full"
          />
          <button onClick={commit} className="text-primary"><Check className="h-3 w-3" /></button>
          <button onClick={() => setEditing(false)} className="text-muted-foreground"><X className="h-3 w-3" /></button>
        </div>
      ) : (
        <button
          onClick={startEdit} title="Click to edit"
          className={`text-sm text-left flex items-center gap-1 group hover:text-primary transition-colors ${mono ? "font-mono" : ""} ${!value ? "text-muted-foreground/50 italic" : ""}`}
        >
          <span>{value != null && value !== "" ? String(value) : placeholder}</span>
          <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 shrink-0" />
        </button>
      )}
    </div>
  );
}

// ─── Payment History Dialog ───────────────────────────────────────────────────

function PaymentHistoryDialog({ record, open, onClose }: { record: ExtractedTenant; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Payment History — {record.firstName} {record.lastName}</DialogTitle>
        </DialogHeader>
        {!record.paymentHistory?.length ? (
          <p className="text-sm text-muted-foreground py-4">No payment history in this document.</p>
        ) : (
          <div className="overflow-y-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Date</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Amount</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {record.paymentHistory.map((p, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-3 py-2 text-sm">{p.date}</td>
                    <td className="px-3 py-2 text-sm font-mono">${p.amount.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <Badge variant={p.status === "paid" ? "default" : p.status === "overdue" ? "destructive" : "secondary"} className="text-xs">
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">{p.method || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Tenant Card ──────────────────────────────────────────────────────────────

function TenantCard({ record, isConflict, onUpdate, onRemove, onViewHistory }: {
  record: ExtractedTenant & { _conflict?: boolean };
  isConflict: boolean;
  onUpdate: (field: keyof ExtractedTenant, value: string) => void;
  onRemove: () => void;
  onViewHistory: () => void;
}) {
  return (
    <div className={`bg-background rounded-2xl border shadow-sm p-5 relative ${isConflict ? "border-yellow-300 bg-yellow-50/30 dark:bg-yellow-900/10" : ""}`}>
      {isConflict && (
        <div className="absolute top-3 right-10 flex items-center gap-1 text-xs text-yellow-700 bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-300 border border-yellow-200 rounded-full px-2 py-0.5">
          <AlertTriangle className="h-3 w-3" /> Already in system
        </div>
      )}
      <button onClick={onRemove} className="absolute top-3 right-3 text-muted-foreground/40 hover:text-destructive transition-colors" title="Remove">
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-4 mb-4">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
          {record.firstName?.[0]}{record.lastName?.[0]}
        </div>
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
          <Field label="First name" value={record.firstName} onChange={(v) => onUpdate("firstName", v)} />
          <Field label="Last name" value={record.lastName} onChange={(v) => onUpdate("lastName", v)} />
          <Field label="Phone" value={record.phone} onChange={(v) => onUpdate("phone", v)} placeholder="no phone" />
          <Field label="Email" value={record.email} onChange={(v) => onUpdate("email", v)} placeholder="no email" />
          {record.notes && <div className="col-span-2 md:col-span-1"><Field label="Notes" value={record.notes} onChange={(v) => onUpdate("notes", v)} /></div>}
        </div>
      </div>

      <div className="border-t pt-4 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
        <div className="col-span-2">
          <Field label="Property address" value={record.propertyAddress} onChange={(v) => onUpdate("propertyAddress", v)} placeholder="no address" />
        </div>
        <Field label="Unit" value={record.unitNumber} onChange={(v) => onUpdate("unitNumber", v)} placeholder="1" />
        <Field label="City" value={record.city} onChange={(v) => onUpdate("city", v)} placeholder="—" />

        <Field label="Rent / month" value={record.rentAmount ? `$${record.rentAmount.toLocaleString()}` : undefined} onChange={(v) => onUpdate("rentAmount", v.replace(/[$,]/g, ""))} placeholder="—" mono />
        <Field label="Deposit" value={record.depositAmount ? `$${record.depositAmount.toLocaleString()}` : undefined} onChange={(v) => onUpdate("depositAmount", v.replace(/[$,]/g, ""))} placeholder="—" mono />
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Deposit paid</span>
          <span className={`text-sm font-medium ${record.depositPaid ? "text-emerald-600" : "text-amber-600"}`}>
            {record.depositPaid ? "✓ Yes" : "Not yet"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Balance</span>
          <span className={`text-sm font-mono font-semibold ${!record.balance || record.balance === 0 ? "text-emerald-600" : "text-red-600"}`}>
            {record.balance != null ? (record.balance === 0 ? "Current" : `$${record.balance.toLocaleString()} owed`) : "—"}
          </span>
        </div>

        <Field label="Lease start" value={record.leaseStart} onChange={(v) => onUpdate("leaseStart", v)} placeholder="—" />
        <Field label="Lease end" value={record.leaseEnd} onChange={(v) => onUpdate("leaseEnd", v)} placeholder="month-to-month" />

        <div className="col-span-2 flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Payment history</span>
          {record.paymentHistory?.length ? (
            <button onClick={onViewHistory} className="flex items-center gap-1 text-sm text-primary hover:underline w-fit">
              {record.paymentHistory.length} transaction{record.paymentHistory.length !== 1 ? "s" : ""} found
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="text-sm text-muted-foreground/50 italic">none</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MigrationPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const ctx = useMigrationContext();

  // Local state only for the review → import → done flow
  const [commitPhase, setCommitPhase] = useState<CommitPhase>("review");
  const [records, setRecords] = useState<(ExtractedTenant & { _conflict?: boolean })[]>([]);
  const [createLeases, setCreateLeases] = useState(true);
  const [createPayments, setCreatePayments] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [done, setDone] = useState<DoneStats | null>(null);
  const [historyRow, setHistoryRow] = useState<number | null>(null);

  // Cycling progress message index
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    if (ctx.status !== "processing") { setMsgIdx(0); return; }
    const id = setInterval(() => setMsgIdx((i) => (i + 1) % PROGRESS_MESSAGES.length), 3000);
    return () => clearInterval(id);
  }, [ctx.status]);

  // When context finishes, load records into local state for review
  useEffect(() => {
    if (ctx.status === "done" && ctx.records.length) {
      setRecords(ctx.records as (ExtractedTenant & { _conflict?: boolean })[]);
      setCommitPhase("review");
    }
  }, [ctx.status, ctx.records]);

  function startNew() {
    ctx.clearResult();
    setRecords([]);
    setDone(null);
    setCommitPhase("review");
    setProgress({ done: 0, total: 0 });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) ctx.startExtraction(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) ctx.startExtraction(file);
    e.target.value = "";
  }

  function handlePastedText(text: string) {
    if (!text.trim()) return;
    ctx.startExtraction(new File([text], "pasted.csv", { type: "text/csv" }));
  }

  const updateRecord = useCallback((index: number, field: keyof ExtractedTenant, value: string) => {
    setRecords((prev) => prev.map((r, i) => {
      if (i !== index) return r;
      const numFields = ["rentAmount", "depositAmount", "balance"] as const;
      if (numFields.includes(field as typeof numFields[number])) {
        const n = parseFloat(value);
        return { ...r, [field]: isNaN(n) ? undefined : n };
      }
      return { ...r, [field]: value || undefined };
    }));
  }, []);

  async function handleImport() {
    setCommitPhase("importing");
    const total = records.length;
    setProgress({ done: 0, total });
    const agg: DoneStats = { tenants: 0, properties: 0, leases: 0, payments: 0, skipped: 0, errors: [] };

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      const res = await fetch("/api/import/smart?action=commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: chunk, options: { createLeases, createPayments } }),
      });
      if (res.ok) {
        const d = await res.json();
        agg.tenants += d.tenants ?? 0;
        agg.properties += d.properties ?? 0;
        agg.leases += d.leases ?? 0;
        agg.payments += d.payments ?? 0;
        agg.skipped += d.skipped ?? 0;
        agg.errors.push(...(d.errors ?? []));
      } else {
        agg.errors.push(`Batch ${Math.floor(i / CHUNK_SIZE) + 1} failed`);
      }
      setProgress({ done: Math.min(i + CHUNK_SIZE, total), total });
    }

    setDone(agg);
    setCommitPhase("done");
    ctx.clearResult();
  }

  // ── Determine what screen to show ──────────────────────────────────────────

  const isProcessing = ctx.status === "processing";
  const hasRecords = records.length > 0 && ctx.status !== "idle";
  const showUpload = !isProcessing && !hasRecords && commitPhase !== "done";
  const showReview = hasRecords && commitPhase === "review";
  const showImporting = commitPhase === "importing";
  const showDone = commitPhase === "done" && done != null;

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <div className="bg-background border-b px-4 md:px-8 h-14 flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="font-semibold text-lg">Migration Center</h1>
        {showReview && (
          <span className="text-sm text-muted-foreground ml-2">
            Review {records.length} tenant{records.length !== 1 ? "s" : ""} before importing
          </span>
        )}
        {isProcessing && (
          <span className="text-sm text-muted-foreground ml-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse inline-block" />
            {PROGRESS_MESSAGES[msgIdx]}
          </span>
        )}
      </div>

      {/* ── SCREEN 1: Upload ─────────────────────────────────────────────────── */}
      {(showUpload || isProcessing) && (
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">Bring your tenants over</h2>
            <p className="text-muted-foreground text-lg">
              Drop any document — PDF, screenshot, photo, or spreadsheet. AI reads it and sets everything up automatically.
            </p>
          </div>

          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed rounded-2xl p-10 text-center hover:bg-muted/40 hover:border-primary/40 transition-all"
          >
            {isProcessing ? (
              <div className="space-y-5">
                <Sparkles className="h-12 w-12 mx-auto text-primary animate-pulse" />
                <div>
                  <p className="text-xl font-semibold mb-1">{PROGRESS_MESSAGES[msgIdx]}</p>
                  <p className="text-sm text-muted-foreground">{ctx.fileName}</p>
                </div>
                <p className="text-xs text-muted-foreground">You can navigate away — we'll notify you when it's ready</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-semibold mb-1">Drop your file here</p>
                  <p className="text-muted-foreground text-sm">PDF, screenshot, photo, CSV, or Excel</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Choose file
                </Button>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept={ACCEPTED} className="hidden" onChange={onFileChange} />

          {!isProcessing && (
            <div className="mt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or paste data directly</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <textarea
                placeholder="Paste CSV rows, copied spreadsheet data, or any tenant info here…"
                rows={4}
                className="w-full rounded-xl border bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  if (text.trim()) { e.preventDefault(); handlePastedText(text); }
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── SCREEN 2: Review (cards) ──────────────────────────────────────────── */}
      {showReview && (
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          <div className="flex flex-wrap items-center gap-4 bg-background border rounded-xl px-4 py-3 shadow-sm">
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={createLeases} onChange={(e) => setCreateLeases(e.target.checked)} className="rounded" />
                Create properties & leases
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={createPayments} onChange={(e) => setCreatePayments(e.target.checked)} className="rounded" disabled={!createLeases} />
                Import payment history
              </label>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={startNew}>← Upload another</Button>
              <Button size="sm" onClick={handleImport} disabled={records.length === 0} className="gap-2">
                Import {records.length} tenant{records.length !== 1 ? "s" : ""}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {ctx.truncated && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              File was very large — only the first portion was analyzed. Split into smaller batches for a complete import.
            </div>
          )}

          <p className="text-xs text-muted-foreground px-1">Review each tenant below. Click any value to correct it before importing.</p>

          {records.map((r, i) => (
            <TenantCard
              key={i}
              record={r}
              isConflict={!!r._conflict}
              onUpdate={(field, value) => updateRecord(i, field, value)}
              onRemove={() => setRecords((prev) => prev.filter((_, idx) => idx !== i))}
              onViewHistory={() => setHistoryRow(i)}
            />
          ))}

          <div className="flex justify-end pt-2 pb-8">
            <Button onClick={handleImport} disabled={records.length === 0} className="gap-2">
              Import {records.length} tenant{records.length !== 1 ? "s" : ""}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── SCREEN: Importing ─────────────────────────────────────────────────── */}
      {showImporting && (
        <div className="max-w-md mx-auto px-4 py-24 text-center space-y-6">
          <Sparkles className="h-12 w-12 mx-auto text-primary animate-pulse" />
          <div>
            <p className="text-xl font-semibold mb-1">Saving your data…</p>
            <p className="text-muted-foreground text-sm">{progress.done} of {progress.total} tenants</p>
          </div>
          <Progress value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0} className="h-2" />
          <p className="text-xs text-muted-foreground">Please don't close this tab</p>
        </div>
      )}

      {/* ── SCREEN 3: Done ────────────────────────────────────────────────────── */}
      {showDone && done && (
        <div className="max-w-lg mx-auto px-4 py-24 text-center space-y-8">
          <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle className="h-9 w-9 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">All done!</h2>
            <p className="text-muted-foreground">Your tenants are now in GHM.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-left">
            {[
              { label: "Tenants added", value: done.tenants, color: "text-primary" },
              { label: "Properties created", value: done.properties, color: "text-blue-600" },
              { label: "Leases created", value: done.leases, color: "text-purple-600" },
              { label: "Payment records", value: done.payments, color: "text-emerald-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-muted/40 rounded-xl p-4 border">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {done.errors.length > 0 && (
            <div className="text-left rounded-xl bg-yellow-50 border border-yellow-200 p-4 space-y-1">
              <p className="text-sm font-medium flex items-center gap-1.5 text-yellow-800">
                <AlertTriangle className="h-4 w-4" /> {done.skipped} record{done.skipped !== 1 ? "s" : ""} skipped
              </p>
              {done.errors.slice(0, 5).map((e, i) => (
                <p key={i} className="text-xs text-yellow-700 pl-5">{e}</p>
              ))}
              {done.errors.length > 5 && <p className="text-xs text-yellow-600 pl-5">…and {done.errors.length - 5} more</p>}
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Button onClick={() => router.push("/tenants")} className="gap-2">View Tenants <ArrowRight className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>Dashboard</Button>
          </div>
          <button onClick={startNew} className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
            Import another document
          </button>
        </div>
      )}

      {historyRow !== null && records[historyRow] && (
        <PaymentHistoryDialog record={records[historyRow]} open={true} onClose={() => setHistoryRow(null)} />
      )}
    </div>
  );
}
