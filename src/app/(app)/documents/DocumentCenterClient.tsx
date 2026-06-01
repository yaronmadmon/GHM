"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  FolderOpen,
  Upload,
  Sparkles,
  FileText,
  ExternalLink,
  AlertTriangle,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import type { ParsedDocument, ExpenseField, BillingPeriod } from "@/lib/document-parser";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType = "utility" | "maintenance" | "tax" | "insurance" | "legal" | "other";

interface Property {
  id: string;
  name: string;
  address: string;
}

interface SavedDocument {
  id: string;
  organizationId: string;
  propertyId: string | null;
  documentType: string;
  vendor: string | null;
  amount: number | null;
  issueDate: string | null;
  dueDate: string | null;
  fileUrl: string;
  fileKey: string | null;
  fileName: string;
  confidenceScore: number | null;
  aiEstimated: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  property: { id: string; name: string } | null;
}

interface ConfirmForm {
  propertyId: string;
  documentType: DocType;
  vendor: string;
  amount: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  expenseField: ExpenseField;
  billingPeriod: BillingPeriod;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  utility: "Utility",
  maintenance: "Maintenance",
  tax: "Tax",
  insurance: "Insurance",
  legal: "Legal",
  other: "Other",
};

const DOC_TYPE_ORDER: DocType[] = ["utility", "maintenance", "tax", "insurance", "legal", "other"];

const EXPENSE_FIELD_LABELS: Record<string, string> = {
  property_tax: "Property Tax",
  water_sewer: "Water & Sewer",
  electricity: "Electricity",
  gas: "Gas",
  insurance: "Insurance",
  mortgage: "Mortgage",
  hoa: "HOA",
  other_expense: "Other Expense",
};

const PERIOD_DIVISOR: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
  unknown: 1,
};

const ACCEPTED = "image/*,application/pdf,.pdf";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: number | null) {
  if (amount == null) return null;
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateShort(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function computeMonthly(amount: string, billingPeriod: BillingPeriod): number | null {
  const n = parseFloat(amount);
  if (!amount || isNaN(n) || n <= 0) return null;
  return Math.round((n / (PERIOD_DIVISOR[billingPeriod] ?? 1)) * 100) / 100;
}

// ─── Doc Type Badge ───────────────────────────────────────────────────────────

const DOC_TYPE_COLORS: Record<string, string> = {
  utility: "bg-blue-100 text-blue-700 border-blue-200",
  maintenance: "bg-orange-100 text-orange-700 border-orange-200",
  tax: "bg-red-100 text-red-700 border-red-200",
  insurance: "bg-purple-100 text-purple-700 border-purple-200",
  legal: "bg-gray-100 text-gray-700 border-gray-200",
  other: "bg-muted text-muted-foreground border-border",
};

function DocTypeBadge({ type }: { type: string }) {
  return (
    <Badge
      variant="outline"
      className={`text-xs capitalize ${DOC_TYPE_COLORS[type] ?? DOC_TYPE_COLORS.other}`}
    >
      {DOC_TYPE_LABELS[type] ?? type}
    </Badge>
  );
}

// ─── Expense Update Preview ───────────────────────────────────────────────────

function ExpenseUpdatePreview({
  expenseField,
  amount,
  billingPeriod,
}: {
  expenseField: ExpenseField;
  amount: string;
  billingPeriod: BillingPeriod;
}) {
  const monthly = computeMonthly(amount, billingPeriod);
  if (!expenseField || !monthly) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <TrendingDown className="h-3 w-3" />
        No expense field will be updated
      </p>
    );
  }
  const label = EXPENSE_FIELD_LABELS[expenseField] ?? expenseField;
  const periodNote =
    billingPeriod === "annual"
      ? " (annual ÷ 12)"
      : billingPeriod === "quarterly"
        ? " (quarterly ÷ 3)"
        : "";
  return (
    <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
      <TrendingDown className="h-3 w-3" />
      Will update: {label} → {formatAmount(monthly)}/mo{periodNote}
    </p>
  );
}

// ─── Document Card ────────────────────────────────────────────────────────────

function DocumentCard({ doc }: { doc: SavedDocument }) {
  const isDataUri = doc.fileUrl.startsWith("data:");
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.fileName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {doc.property?.name && (
            <span className="font-medium text-foreground/70">{doc.property.name} · </span>
          )}
          {doc.vendor && <span>{doc.vendor} · </span>}
          {formatAmount(doc.amount) && (
            <span className="font-mono">{formatAmount(doc.amount)} · </span>
          )}
          {formatDateShort(doc.issueDate) ?? formatDateShort(doc.createdAt)}
        </p>
        {doc.notes && (
          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{doc.notes}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <DocTypeBadge type={doc.documentType} />
        {!isDataUri ? (
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-0.5"
          >
            View <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <a
            href={doc.fileUrl}
            download={doc.fileName}
            className="text-xs text-primary hover:underline"
          >
            Download
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  initialDocuments: SavedDocument[];
  properties: Property[];
}

export function DocumentCenterClient({ initialDocuments, properties }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [parsedDoc, setParsedDoc] = useState<ParsedDocument | null>(null);
  const [pendingMeta, setPendingMeta] = useState<{
    fileUrl: string;
    fileKey: string | null;
    fileName: string;
  } | null>(null);
  const [form, setForm] = useState<ConfirmForm>({
    propertyId: "",
    documentType: "other",
    vendor: "",
    amount: "",
    issueDate: "",
    dueDate: "",
    notes: "",
    expenseField: null,
    billingPeriod: "unknown",
  });
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState<SavedDocument[]>(initialDocuments);

  function setField<K extends keyof ConfirmForm>(key: K, value: ConfirmForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const handleFile = useCallback(async (file: File) => {
    const MAX = 4 * 1024 * 1024; // 4 MB — Vercel request body limit
    if (file.size > MAX) {
      toast.error("File too large. Max 4 MB.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error((d as { error?: string }).error ?? "Failed to analyze document");
        return;
      }
      const data = (await res.json()) as {
        parsed: ParsedDocument;
        fileUrl: string;
        fileKey: string | null;
        fileName: string;
      };

      setParsedDoc(data.parsed);
      setPendingMeta({
        fileUrl: data.fileUrl,
        fileKey: data.fileKey,
        fileName: data.fileName,
      });

      const ed = data.parsed.extracted_data;
      setForm({
        propertyId: ed.property_id ?? "",
        documentType: ed.document_type ?? "other",
        vendor: ed.vendor ?? "",
        amount: ed.amount != null ? String(ed.amount) : "",
        issueDate: ed.issue_date ?? "",
        dueDate: ed.due_date ?? "",
        notes: "",
        expenseField: ed.expense_field ?? null,
        billingPeriod: ed.billing_period ?? "unknown",
      });

      setModalOpen(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  async function handleSave() {
    if (!pendingMeta) return;
    setSaving(true);
    try {
      const res = await fetch("/api/documents/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: pendingMeta.fileUrl,
          fileKey: pendingMeta.fileKey,
          fileName: pendingMeta.fileName,
          propertyId: form.propertyId || null,
          documentType: form.documentType,
          vendor: form.vendor || null,
          amount: form.amount ? parseFloat(form.amount) : null,
          issueDate: form.issueDate || null,
          dueDate: form.dueDate || null,
          confidenceScore: parsedDoc?.confidence_score ?? null,
          notes: form.notes || null,
          expenseField: form.expenseField,
          billingPeriod: form.billingPeriod,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error((d as { error?: string }).error ?? "Failed to save document");
        return;
      }

      const saved = (await res.json()) as SavedDocument & {
        property?: { id: string; name: string } | null;
      };

      const propMatch = form.propertyId ? properties.find((p) => p.id === form.propertyId) : null;
      const enriched: SavedDocument = {
        ...saved,
        property:
          saved.property ?? (propMatch ? { id: propMatch.id, name: propMatch.name } : null),
      };

      setDocuments((prev) => [enriched, ...prev]);
      setModalOpen(false);
      setParsedDoc(null);
      setPendingMeta(null);

      const monthly = computeMonthly(form.amount, form.billingPeriod);
      if (form.expenseField && monthly) {
        toast.success(
          `Document saved · ${EXPENSE_FIELD_LABELS[form.expenseField]} updated to ${formatAmount(monthly)}/mo`,
        );
      } else {
        toast.success("Document saved");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setParsedDoc(null);
    setPendingMeta(null);
  }

  const grouped = DOC_TYPE_ORDER.reduce<Record<string, SavedDocument[]>>((acc, type) => {
    acc[type] = documents.filter((d) => d.documentType === type);
    return acc;
  }, {});

  return (
    <div className="page-shell page-stack">
      <section className="office-header">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="page-kicker">AI filing cabinet</p>
            <h1 className="page-title mt-2">Document Center</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Upload utility bills, tax receipts, insurance documents, and invoices. AI reads each file, matches it to a property, and prepares the expense card update for review.
            </p>
          </div>
          <div className="rounded-md border bg-background/55 p-3">
            <p className="text-xs text-muted-foreground">Filed documents</p>
            <p className="mt-1 font-mono text-xl font-semibold">{documents.length}</p>
          </div>
        </div>
      </section>

      <div className="space-y-6">

        {/* Upload zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          className={`rounded-lg border-2 border-dashed bg-card p-10 text-center shadow-sm transition-all
            ${dragging ? "border-primary/60 bg-primary/5" : "hover:border-primary/40 hover:bg-muted/35"}
            ${uploading ? "pointer-events-none opacity-70" : ""}`}
        >
          {uploading ? (
            <div className="space-y-4">
              <Sparkles className="h-10 w-10 mx-auto text-primary animate-pulse" />
              <div>
                <p className="text-lg font-semibold">Reading document…</p>
                <p className="text-sm text-muted-foreground mt-1">
                  AI is extracting details — this takes about 15 seconds
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold">Drop a document here</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Photo, screenshot, or PDF · max 4 MB
                </p>
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
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={onFileChange}
        />

        {/* Document list grouped by type */}
        {documents.length > 0 ? (
          <div className="space-y-4">
            {DOC_TYPE_ORDER.map((type) => {
              const docs = grouped[type];
              if (!docs.length) return null;
              return (
                <Card key={type}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <DocTypeBadge type={type} />
                      <span className="text-muted-foreground font-normal">({docs.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {docs.map((doc) => (
                        <DocumentCard key={doc.id} doc={doc} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No documents yet. Upload your first one above.</p>
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirm document details</DialogTitle>
          </DialogHeader>

          <div className="space-y-1 mb-1">
            {parsedDoc && (
              <ConfidenceDot score={parsedDoc.confidence_score} />
            )}
            {parsedDoc?.flags.is_amount_uncertain && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Amount may be uncertain — please verify
              </p>
            )}
            {parsedDoc?.flags.extraction_notes && (
              <p className="text-xs text-muted-foreground italic">
                {parsedDoc.flags.extraction_notes}
              </p>
            )}
            <ExpenseUpdatePreview
              expenseField={form.expenseField}
              amount={form.amount}
              billingPeriod={form.billingPeriod}
            />
          </div>

          <div className="space-y-4">
            {/* Property */}
            <div className="space-y-1.5">
              <Label>Property</Label>
              <Select
                value={form.propertyId}
                onValueChange={(v) => setField("propertyId", v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No property matched — select one" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No property</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Document type */}
            <div className="space-y-1.5">
              <Label>Document type</Label>
              <Select
                value={form.documentType}
                onValueChange={(v) => setField("documentType", (v ?? "other") as DocType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPE_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DOC_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vendor */}
            <div className="space-y-1.5">
              <Label>Vendor / Issuer</Label>
              <Input
                placeholder="e.g. PSE&G, County Tax Office"
                value={form.vendor}
                onChange={(e) => setField("vendor", e.target.value)}
              />
            </div>

            {/* Amount + Billing period */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setField("amount", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Billing period</Label>
                <Select
                  value={form.billingPeriod}
                  onValueChange={(v) =>
                    setField("billingPeriod", (v ?? "unknown") as BillingPeriod)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Issue date</Label>
                <Input
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => setField("issueDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setField("dueDate", e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </div>

            {pendingMeta && (
              <p className="text-xs text-muted-foreground">File: {pendingMeta.fileName}</p>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConfidenceDot({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      AI confidence: {pct}%
    </span>
  );
}
