"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sparkles, Upload, CheckCircle, AlertTriangle,
  Trash2, ChevronRight, ArrowRight, FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import type { ExtractedTenant } from "@/app/api/import/smart/route";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "upload" | "extracting" | "review" | "importing" | "done";

interface DoneStats {
  tenants: number;
  properties: number;
  leases: number;
  payments: number;
  skipped: number;
  errors: string[];
}

// ─── Editable Cell ────────────────────────────────────────────────────────────

function EditableCell({
  value,
  onChange,
  className = "",
  placeholder = "—",
  type = "text",
}: {
  value: string | number | undefined | null;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEdit() {
    setDraft(value != null ? String(value) : "");
    setEditing(true);
  }

  function commit() {
    onChange(draft);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className={`w-full border-b border-primary bg-primary/5 outline-none px-1 py-0.5 text-sm rounded-sm ${className}`}
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      title="Click to edit"
      className={`cursor-text hover:bg-muted/60 rounded px-1 py-0.5 min-w-[32px] inline-block ${className} ${!value ? "text-muted-foreground/50" : ""}`}
    >
      {value != null && value !== "" ? String(value) : placeholder}
    </span>
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
          <p className="text-sm text-muted-foreground py-4">No payment history found.</p>
        ) : (
          <div className="overflow-y-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {record.paymentHistory.map((p, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{p.date}</td>
                    <td className="px-3 py-2 font-mono">${p.amount.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <Badge variant={p.status === "paid" ? "default" : p.status === "overdue" ? "destructive" : "secondary"} className="text-xs">
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{p.method || "—"}</td>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 15;

export default function MigrationPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("upload");
  const [records, setRecords] = useState<ExtractedTenant[]>([]);
  const [conflicts, setConflicts] = useState<Set<string>>(new Set());
  const [createLeases, setCreateLeases] = useState(true);
  const [createPayments, setCreatePayments] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [done, setDone] = useState<DoneStats | null>(null);
  const [historyRow, setHistoryRow] = useState<number | null>(null);

  // ── Upload & Extract ──────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setPhase("extracting");
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/import/smart?action=extract", { method: "POST", body: fd });
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error ?? "Failed to read file");
      setPhase("upload");
      return;
    }

    const data = await res.json();
    if (!data.extracted?.length) {
      toast.error("No tenant records found. Make sure the file contains tenant data.");
      setPhase("upload");
      return;
    }

    setTruncated(data.truncated ?? false);

    // Check conflicts
    const emails = data.extracted.map((r: ExtractedTenant) => r.email).filter(Boolean);
    let conflictSet = new Set<string>();
    if (emails.length) {
      const cr = await fetch("/api/import/smart?action=check-conflicts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      if (cr.ok) {
        const cd = await cr.json();
        conflictSet = new Set<string>(cd.existing ?? []);
      }
    }

    setRecords(data.extracted);
    setConflicts(conflictSet);
    setPhase("review");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  // ── Edit record ───────────────────────────────────────────────────────────

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

  function removeRecord(index: number) {
    setRecords((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Commit (batched) ──────────────────────────────────────────────────────

  async function handleImport() {
    setPhase("importing");
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
    setPhase("done");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <div className="bg-background border-b px-4 md:px-8 h-14 flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="font-semibold text-lg">Migration Center</h1>
        {phase === "review" && (
          <span className="text-sm text-muted-foreground ml-2">
            {records.length} tenant{records.length !== 1 ? "s" : ""} ready to import
          </span>
        )}
      </div>

      {/* ── SCREEN 1: Upload ─────────────────────────────────────────────── */}
      {(phase === "upload" || phase === "extracting") && (
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">Bring your data over</h2>
            <p className="text-muted-foreground text-lg">
              Upload a tenant ledger from any platform. Claude reads it and sets everything up automatically — no manual entry.
            </p>
          </div>

          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !phase.startsWith("extract") && fileRef.current?.click()}
            className="border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer hover:bg-muted/40 hover:border-primary/40 transition-all"
          >
            {phase === "extracting" ? (
              <div className="space-y-4">
                <Sparkles className="h-12 w-12 mx-auto text-primary animate-pulse" />
                <p className="text-xl font-semibold">Reading your file…</p>
                <p className="text-muted-foreground">Claude is extracting tenant records, lease terms, and payment history</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-semibold mb-1">Drop your file here</p>
                  <p className="text-muted-foreground">or click to browse</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Supports exports from <span className="font-medium">Buildium</span>, <span className="font-medium">AppFolio</span>, <span className="font-medium">Cozy</span>, <span className="font-medium">Rentec</span>, or any CSV / Excel spreadsheet
                </p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={onFileChange} />
        </div>
      )}

      {/* ── SCREEN 2: Review ─────────────────────────────────────────────── */}
      {phase === "review" && (
        <div className="px-4 md:px-6 py-6 max-w-full">
          {/* Options + actions bar */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={createLeases} onChange={(e) => setCreateLeases(e.target.checked)} className="rounded" />
                Create properties, units & leases
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={createPayments} onChange={(e) => setCreatePayments(e.target.checked)} className="rounded" disabled={!createLeases} />
                Import payment history
              </label>
            </div>

            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setPhase("upload"); setRecords([]); }}>
                ← Upload different file
              </Button>
              <Button size="sm" onClick={handleImport} disabled={records.length === 0} className="gap-2">
                Import {records.length} tenant{records.length !== 1 ? "s" : ""}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {truncated && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              File was very large — only the first portion was analyzed. Split into smaller batches for a full import.
            </div>
          )}

          {conflicts.size > 0 && (
            <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-4">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {conflicts.size} tenant{conflicts.size !== 1 ? "s" : ""} already exist in your system (marked ⚠). They will be skipped on import.
            </div>
          )}

          <p className="text-xs text-muted-foreground mb-3">
            Click any cell to edit. Changes are saved when you press Enter or click away.
          </p>

          {/* Editable table */}
          <div className="rounded-xl border bg-background overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground w-8">#</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">First Name</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Last Name</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Phone</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Property Address</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Unit</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Rent/mo</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Deposit</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Balance</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Lease Start</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Lease End</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Payments</th>
                    <th className="w-8 px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {records.map((r, i) => {
                    const isConflict = !!(r.email && conflicts.has(r.email));
                    return (
                      <tr
                        key={i}
                        className={`hover:bg-muted/20 transition-colors ${isConflict ? "border-l-4 border-l-yellow-400 bg-yellow-50/30" : ""}`}
                      >
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
                        <td className="px-3 py-2.5">
                          <EditableCell value={r.firstName} onChange={(v) => updateRecord(i, "firstName", v)} />
                        </td>
                        <td className="px-3 py-2.5">
                          <EditableCell value={r.lastName} onChange={(v) => updateRecord(i, "lastName", v)} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {isConflict && (
                              <span title="Already in system" className="text-yellow-500 text-xs shrink-0">⚠</span>
                            )}
                            <EditableCell value={r.email} onChange={(v) => updateRecord(i, "email", v)} placeholder="no email" />
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <EditableCell value={r.phone} onChange={(v) => updateRecord(i, "phone", v)} placeholder="no phone" />
                        </td>
                        <td className="px-3 py-2.5 max-w-[180px]">
                          <EditableCell value={r.propertyAddress} onChange={(v) => updateRecord(i, "propertyAddress", v)} placeholder="no address" />
                        </td>
                        <td className="px-3 py-2.5">
                          <EditableCell value={r.unitNumber} onChange={(v) => updateRecord(i, "unitNumber", v)} placeholder="1" />
                        </td>
                        <td className="px-3 py-2.5">
                          <EditableCell
                            value={r.rentAmount}
                            onChange={(v) => updateRecord(i, "rentAmount", v)}
                            type="number"
                            placeholder="—"
                            className="font-mono"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          {r.depositAmount ? (
                            <span className={`font-mono text-xs ${r.depositPaid ? "text-emerald-600" : "text-amber-600"}`}>
                              <EditableCell
                                value={r.depositAmount}
                                onChange={(v) => updateRecord(i, "depositAmount", v)}
                                type="number"
                                className="font-mono"
                              />
                              <span className="ml-1">{r.depositPaid ? "✓" : "unpaid"}</span>
                            </span>
                          ) : (
                            <EditableCell value={r.depositAmount} onChange={(v) => updateRecord(i, "depositAmount", v)} type="number" placeholder="—" className="font-mono" />
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.balance != null && r.balance > 0 ? (
                            <span className="text-red-600 font-mono font-semibold text-xs">${r.balance.toLocaleString()}</span>
                          ) : r.balance === 0 ? (
                            <span className="text-emerald-600 text-xs">Current</span>
                          ) : (
                            <EditableCell value={r.balance} onChange={(v) => updateRecord(i, "balance", v)} type="number" placeholder="—" className="font-mono" />
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <EditableCell value={r.leaseStart} onChange={(v) => updateRecord(i, "leaseStart", v)} placeholder="—" />
                        </td>
                        <td className="px-3 py-2.5">
                          <EditableCell value={r.leaseEnd} onChange={(v) => updateRecord(i, "leaseEnd", v)} placeholder="ongoing" />
                        </td>
                        <td className="px-3 py-2.5">
                          {r.paymentHistory?.length ? (
                            <button
                              onClick={() => setHistoryRow(i)}
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              {r.paymentHistory.length} records
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <button onClick={() => removeRecord(i)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom action bar */}
          <div className="mt-4 flex justify-end">
            <Button onClick={handleImport} disabled={records.length === 0} className="gap-2">
              Import {records.length} tenant{records.length !== 1 ? "s" : ""}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── SCREEN: Importing (progress) ─────────────────────────────────── */}
      {phase === "importing" && (
        <div className="max-w-md mx-auto px-4 py-24 text-center space-y-6">
          <Sparkles className="h-12 w-12 mx-auto text-primary animate-pulse" />
          <div>
            <p className="text-xl font-semibold mb-1">Importing your data…</p>
            <p className="text-muted-foreground text-sm">
              {progress.done} of {progress.total} tenants
            </p>
          </div>
          <Progress value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0} className="h-2" />
          <p className="text-xs text-muted-foreground">Please don't close this tab</p>
        </div>
      )}

      {/* ── SCREEN 3: Done ───────────────────────────────────────────────── */}
      {phase === "done" && done && (
        <div className="max-w-lg mx-auto px-4 py-24 text-center space-y-8">
          <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle className="h-9 w-9 text-emerald-600" />
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-2">Migration complete</h2>
            <p className="text-muted-foreground">Your data is now in GHM.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-left">
            {[
              { label: "Tenants created", value: done.tenants, color: "text-primary" },
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
            <div className="text-left rounded-lg bg-yellow-50 border border-yellow-200 p-4 space-y-1">
              <p className="text-sm font-medium flex items-center gap-1.5 text-yellow-800">
                <AlertTriangle className="h-4 w-4" /> {done.skipped} record{done.skipped !== 1 ? "s" : ""} skipped
              </p>
              {done.errors.slice(0, 5).map((e, i) => (
                <p key={i} className="text-xs text-yellow-700 pl-5">{e}</p>
              ))}
              {done.errors.length > 5 && (
                <p className="text-xs text-yellow-600 pl-5">…and {done.errors.length - 5} more</p>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <Button onClick={() => router.push("/tenants")} className="gap-2">
              View Tenants <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Go to Dashboard
            </Button>
          </div>

          <button
            onClick={() => { setPhase("upload"); setRecords([]); setDone(null); setProgress({ done: 0, total: 0 }); }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Import another file
          </button>
        </div>
      )}

      {/* Payment history dialog */}
      {historyRow !== null && records[historyRow] && (
        <PaymentHistoryDialog
          record={records[historyRow]}
          open={true}
          onClose={() => setHistoryRow(null)}
        />
      )}

      {/* Hidden file input for drag & drop */}
      <FileSpreadsheet className="hidden" />
    </div>
  );
}
