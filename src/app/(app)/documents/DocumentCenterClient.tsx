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
  AlertTriangle,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  Sparkles,
  TrendingDown,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { ParsedDocument, ExpenseField, BillingPeriod } from "@/lib/document-parser";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType = "utility" | "maintenance" | "tax" | "insurance" | "legal" | "notice" | "other";

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
  pastDueAmount: string;
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
  notice: "Notice",
  other: "Other",
};

const DOC_TYPE_ORDER: DocType[] = ["notice", "utility", "maintenance", "tax", "insurance", "legal", "other"];

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
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function computeMonthly(amount: string, billingPeriod: BillingPeriod): number | null {
  const n = parseFloat(amount);
  if (!amount || isNaN(n) || n <= 0) return null;
  return Math.round((n / (PERIOD_DIVISOR[billingPeriod] ?? 1)) * 100) / 100;
}

function isImageUrl(url: string) {
  if (url.startsWith("data:image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

function isPdfUrl(url: string) {
  if (url.startsWith("data:application/pdf")) return true;
  return /\.pdf(\?|$)/i.test(url);
}

// ─── Doc Type Badge ───────────────────────────────────────────────────────────

const LEGAL_SUBTYPE_LABELS: Record<string, string> = {
  court_summons: "Court Summons",
  eviction_filing: "Eviction Filing",
  lawsuit: "Lawsuit",
  lien: "Lien",
  code_violation: "Code Violation",
  demand_letter: "Demand Letter",
  shut_off_warning: "Shut-Off Warning",
  past_due_notice: "Past-Due Notice",
  violation_notice: "Violation Notice",
  other_notice: "Notice",
};

const LEGAL_SUBTYPE_COLORS: Record<string, string> = {
  court_summons: "bg-red-100 text-red-800 border-red-300",
  eviction_filing: "bg-red-100 text-red-800 border-red-300",
  lawsuit: "bg-red-100 text-red-800 border-red-300",
  lien: "bg-red-100 text-red-800 border-red-300",
  code_violation: "bg-orange-100 text-orange-800 border-orange-300",
  demand_letter: "bg-orange-100 text-orange-800 border-orange-300",
  shut_off_warning: "bg-red-100 text-red-800 border-red-300",
  past_due_notice: "bg-amber-100 text-amber-700 border-amber-200",
  violation_notice: "bg-orange-100 text-orange-800 border-orange-300",
  other_notice: "bg-amber-100 text-amber-700 border-amber-200",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  utility: "bg-blue-100 text-blue-700 border-blue-200",
  maintenance: "bg-orange-100 text-orange-700 border-orange-200",
  tax: "bg-red-100 text-red-700 border-red-200",
  insurance: "bg-purple-100 text-purple-700 border-purple-200",
  legal: "bg-gray-100 text-gray-700 border-gray-200",
  notice: "bg-amber-100 text-amber-700 border-amber-200",
  other: "bg-muted text-muted-foreground border-border",
};

function DocTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline" className={`text-xs capitalize ${DOC_TYPE_COLORS[type] ?? DOC_TYPE_COLORS.other}`}>
      {DOC_TYPE_LABELS[type] ?? type}
    </Badge>
  );
}

// ─── Expense Update Preview ───────────────────────────────────────────────────

function ExpenseUpdatePreview({ expenseField, amount, billingPeriod }: {
  expenseField: ExpenseField; amount: string; billingPeriod: BillingPeriod;
}) {
  const monthly = computeMonthly(amount, billingPeriod);
  if (!expenseField || !monthly) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <TrendingDown className="h-3 w-3" /> No expense field will be updated
      </p>
    );
  }
  const label = EXPENSE_FIELD_LABELS[expenseField] ?? expenseField;
  const periodNote = billingPeriod === "annual" ? " (annual ÷ 12)" : billingPeriod === "quarterly" ? " (quarterly ÷ 3)" : "";
  return (
    <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
      <TrendingDown className="h-3 w-3" />
      Will update: {label} → {formatAmount(monthly)}/mo{periodNote}
    </p>
  );
}

// ─── Document Preview Modal ───────────────────────────────────────────────────

function PdfDataUriViewer({ fileUrl, fileName }: { fileUrl: string; fileName: string }) {
  const [objUrl] = useState(() => {
    try {
      const base64 = fileUrl.split(",")[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    } catch { return null; }
  });
  if (!objUrl) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
      <p className="text-sm">Could not render PDF.</p>
      <a href={fileUrl} download={fileName} className="text-sm text-primary hover:underline">Download instead</a>
    </div>
  );
  return <iframe src={objUrl} className="w-full rounded-md" style={{ height: "70vh" }} title={fileName} />;
}

function DocumentPreviewModal({ doc, open, onClose }: { doc: SavedDocument | null; open: boolean; onClose: () => void }) {
  if (!doc) return null;
  const isImage = isImageUrl(doc.fileUrl);
  const isPdf = isPdfUrl(doc.fileUrl);
  const isDataUri = doc.fileUrl.startsWith("data:");
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate text-base">{doc.fileName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto min-h-0">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doc.fileUrl} alt={doc.fileName} className="w-full rounded-md object-contain max-h-[70vh]" />
          ) : isPdf && !isDataUri ? (
            <iframe src={doc.fileUrl} className="w-full rounded-md" style={{ height: "70vh" }} title={doc.fileName} />
          ) : isPdf && isDataUri ? (
            <PdfDataUriViewer fileUrl={doc.fileUrl} fileName={doc.fileName} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
              <FileText className="h-12 w-12 opacity-30" />
              <p className="text-sm">Preview not available.</p>
              <a href={doc.fileUrl} download={doc.fileName} className="text-sm text-primary hover:underline">Download to view</a>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between pt-2 border-t gap-2 flex-wrap">
          <div className="text-xs text-muted-foreground space-y-0.5">
            {doc.property?.name && <p>Property: {doc.property.name}</p>}
            {doc.vendor && <p>Vendor: {doc.vendor}</p>}
            {doc.amount != null && <p>Amount: {formatAmount(doc.amount)}</p>}
          </div>
          {!isDataUri ? (
            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="gap-2">
                <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
              </Button>
            </a>
          ) : (
            <a href={doc.fileUrl} download={doc.fileName}>
              <Button size="sm" variant="outline">Download</Button>
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Document Row ─────────────────────────────────────────────────────────────

function DocumentRow({ doc, onPreview }: { doc: SavedDocument; onPreview: (doc: SavedDocument) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.fileName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {doc.vendor && <span>{doc.vendor} · </span>}
          {formatAmount(doc.amount) && <span className="font-mono">{formatAmount(doc.amount)} · </span>}
          {formatDateShort(doc.issueDate) ?? formatDateShort(doc.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <DocTypeBadge type={doc.documentType} />
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-primary" onClick={() => onPreview(doc)}>
          <Eye className="h-3.5 w-3.5" /> View
        </Button>
      </div>
    </div>
  );
}

// ─── Property Folder ─────────────────────────────────────────────────────────

function PropertyFolder({ property, docs, onPreview }: {
  property: Property | null;
  docs: SavedDocument[];
  onPreview: (doc: SavedDocument) => void;
}) {
  const [open, setOpen] = useState(true);
  const title = property ? property.name : "Other";
  const subtitle = property ? property.address : "General documents not linked to a specific property";

  return (
    <Card>
      <CardHeader
        className="flex flex-row items-center justify-between border-b pb-3 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <FolderOpen className={`h-4 w-4 ${property ? "text-primary" : "text-muted-foreground"}`} />
          {title}
          <span className="ml-1 text-xs font-normal text-muted-foreground">({docs.length})</span>
        </CardTitle>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-muted-foreground sm:block truncate max-w-[220px]">{subtitle}</p>
          <span className="text-xs text-muted-foreground">{open ? "▲" : "▼"}</span>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="p-0">
          {docs.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted-foreground">
              {property
                ? "No documents filed yet — upload a bill or document and AI will place it here."
                : "No unmatched documents. All uploads have been matched to a property."}
            </p>
          ) : (
            <div className="divide-y">
              {docs.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} onPreview={onPreview} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
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
  const [pendingMeta, setPendingMeta] = useState<{ fileUrl: string; fileKey: string | null; fileName: string } | null>(null);
  const [form, setForm] = useState<ConfirmForm>({
    propertyId: "", documentType: "other", vendor: "", amount: "", pastDueAmount: "",
    issueDate: "", dueDate: "", notes: "", expenseField: null, billingPeriod: "unknown",
  });
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState<SavedDocument[]>(initialDocuments);

  const [previewDoc, setPreviewDoc] = useState<SavedDocument | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  function setField<K extends keyof ConfirmForm>(key: K, value: ConfirmForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const handleFile = useCallback(async (file: File) => {
    if (file.size > 4 * 1024 * 1024) { toast.error("File too large. Max 4 MB."); return; }
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
      const data = await res.json() as { parsed: ParsedDocument; fileUrl: string; fileKey: string | null; fileName: string };

      setParsedDoc(data.parsed);
      setPendingMeta({ fileUrl: data.fileUrl, fileKey: data.fileKey, fileName: data.fileName });

      const ed = data.parsed.extracted_data;
      setForm({
        propertyId: ed.property_id ?? "",
        documentType: (ed.document_type ?? "other") as DocType,
        vendor: ed.vendor ?? "",
        amount: ed.amount != null ? String(ed.amount) : "",
        pastDueAmount: ed.past_due_amount != null ? String(ed.past_due_amount) : "",
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
    e.preventDefault(); setDragging(false);
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
      const isPastDueNotice = form.documentType === "notice" || parsedDoc?.extracted_data?.is_past_due_notice === true;
      const res = await fetch("/api/documents/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: pendingMeta.fileUrl, fileKey: pendingMeta.fileKey, fileName: pendingMeta.fileName,
          propertyId: form.propertyId || null,
          documentType: form.documentType,
          vendor: form.vendor || null,
          amount: form.amount ? parseFloat(form.amount) : null,
          pastDueAmount: form.pastDueAmount ? parseFloat(form.pastDueAmount) : null,
          isPastDueNotice,
          legalSubtype: parsedDoc?.extracted_data?.legal_subtype ?? null,
          extractionNotes: parsedDoc?.flags?.extraction_notes ?? "",
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

      const saved = await res.json() as SavedDocument & { property?: { id: string; name: string } | null; taskCreated?: boolean };
      const propMatch = form.propertyId ? properties.find((p) => p.id === form.propertyId) : null;
      const enriched: SavedDocument = {
        ...saved,
        property: saved.property ?? (propMatch ? { id: propMatch.id, name: propMatch.name } : null),
      };

      setDocuments((prev) => [enriched, ...prev]);
      setModalOpen(false); setParsedDoc(null); setPendingMeta(null);

      const propName = enriched.property?.name;
      const monthly = computeMonthly(form.amount, form.billingPeriod);
      if (saved.taskCreated) {
        toast.success(`Filed to ${propName ?? "Unassigned"} · Task created for follow-up`);
      } else if (form.expenseField && monthly) {
        toast.success(`Filed to ${propName ?? "Unassigned"} · ${EXPENSE_FIELD_LABELS[form.expenseField]} → ${formatAmount(monthly)}/mo`);
      } else {
        toast.success(`Filed to ${propName ?? "Unassigned"}`);
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false); setParsedDoc(null); setPendingMeta(null);
  }

  // Build folder structure: one folder per property + unassigned
  const folders = properties.map((p) => ({
    property: p,
    docs: documents.filter((d) => d.propertyId === p.id),
  }));
  const unassignedDocs = documents.filter((d) => !d.propertyId);

  const totalDocs = documents.length;
  const matchedDocs = documents.filter((d) => d.propertyId).length;

  const isPastDueNotice = form.documentType === "notice" || parsedDoc?.extracted_data?.is_past_due_notice === true;
  const pastDueVal = parseFloat(form.pastDueAmount);
  const hasPastDue = !isNaN(pastDueVal) && pastDueVal > 0;

  // Find the matched property name for the confirm dialog header
  const matchedPropertyName = form.propertyId
    ? (properties.find((p) => p.id === form.propertyId)?.name ?? null)
    : null;

  return (
    <div className="page-shell page-stack">
      <section className="office-header">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="page-kicker">AI filing cabinet</p>
            <h1 className="page-title mt-2">Document Center</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Upload bills, receipts, and notices. AI reads each file, identifies the property, and files it into the right folder automatically.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-md border bg-background/55 p-3">
              <p className="text-xs text-muted-foreground">Total filed</p>
              <p className="mt-1 font-mono text-xl font-semibold">{totalDocs}</p>
            </div>
            <div className="rounded-md border bg-background/55 p-3">
              <p className="text-xs text-muted-foreground">Matched</p>
              <p className="mt-1 font-mono text-xl font-semibold">{matchedDocs}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        {/* Upload zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
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
                <p className="text-sm text-muted-foreground mt-1">AI is identifying the property and extracting details</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold">Drop a document here</p>
                <p className="text-muted-foreground text-sm mt-1">AI will read it and file it into the correct property folder</p>
              </div>
              <Button type="button" variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Choose file
              </Button>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept={ACCEPTED} className="hidden" onChange={onFileChange} />

        {/* Property folders */}
        {properties.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No properties yet. Add a property to create folders.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {folders.map(({ property, docs }) => (
              <PropertyFolder key={property.id} property={property} docs={docs} onPreview={(d) => { setPreviewDoc(d); setPreviewOpen(true); }} />
            ))}
            {/* Other / general folder — always visible */}
            <PropertyFolder property={null} docs={unassignedDocs} onPreview={(d) => { setPreviewDoc(d); setPreviewOpen(true); }} />
          </div>
        )}
      </div>

      {/* Confirmation / review modal */}
      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review before filing</DialogTitle>
          </DialogHeader>

          <div className="space-y-1 mb-1">
            {parsedDoc && <ConfidenceDot score={parsedDoc.confidence_score} />}

            {/* Folder assignment banner */}
            <div className={`flex items-center gap-2 rounded-md border px-3 py-2 ${matchedPropertyName ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700" : "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700"}`}>
              <FolderOpen className={`h-4 w-4 shrink-0 ${matchedPropertyName ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`} />
              <p className={`text-xs font-medium ${matchedPropertyName ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                {matchedPropertyName
                  ? `AI matched → ${matchedPropertyName}`
                  : "No property matched — select one below or it will go to Other"}
              </p>
            </div>

            {isPastDueNotice && (() => {
              const subtype = parsedDoc?.extracted_data?.legal_subtype;
              const subtypeLabel = subtype ? LEGAL_SUBTYPE_LABELS[subtype] : null;
              const subtypeColor = subtype ? LEGAL_SUBTYPE_COLORS[subtype] : null;
              const isUrgent = ["court_summons","eviction_filing","lawsuit","lien","shut_off_warning"].includes(subtype ?? "");
              const deadline = parsedDoc?.extracted_data?.due_date;
              const extractionNotes = parsedDoc?.flags?.extraction_notes;
              return (
                <div className={`rounded-md border px-3 py-2 space-y-1 ${isUrgent ? "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-700" : "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700"}`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 shrink-0 ${isUrgent ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`} />
                    <div className="flex items-center gap-2 flex-wrap">
                      {subtypeLabel && subtypeColor && (
                        <Badge variant="outline" className={`text-xs ${subtypeColor}`}>{subtypeLabel}</Badge>
                      )}
                      <p className={`text-xs font-medium ${isUrgent ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}>
                        {isUrgent ? "Urgent — task and notification will be created." : "A follow-up task will be created automatically."}
                      </p>
                    </div>
                  </div>
                  {deadline && (
                    <p className={`text-xs pl-6 font-semibold ${isUrgent ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}>
                      Deadline / court date: {new Date(deadline).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                  {extractionNotes && (
                    <p className="text-xs pl-6 text-muted-foreground italic">{extractionNotes}</p>
                  )}
                </div>
              );
            })()}
            {!isPastDueNotice && hasPastDue && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  Past-due balance of {formatAmount(pastDueVal)} detected — a task will be created to remind you to resolve it.
                </p>
              </div>
            )}

            {parsedDoc?.flags.is_amount_uncertain && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Amount may be uncertain — please verify
              </p>
            )}
            {parsedDoc?.flags.extraction_notes && (
              <p className="text-xs text-muted-foreground italic">{parsedDoc.flags.extraction_notes}</p>
            )}
            <ExpenseUpdatePreview expenseField={form.expenseField} amount={form.amount} billingPeriod={form.billingPeriod} />
          </div>

          <div className="space-y-4">
            {/* Property (folder selection) */}
            <div className="space-y-1.5">
              <Label>Property folder</Label>
              <Select value={form.propertyId} onValueChange={(v) => setField("propertyId", v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Document type */}
            <div className="space-y-1.5">
              <Label>Document type</Label>
              <Select value={form.documentType} onValueChange={(v) => setField("documentType", (v ?? "other") as DocType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPE_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vendor */}
            <div className="space-y-1.5">
              <Label>Vendor / Issuer</Label>
              <Input placeholder="e.g. PSE&G, County Tax Office" value={form.vendor} onChange={(e) => setField("vendor", e.target.value)} />
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Current charges ($)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={(e) => setField("amount", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Past-due balance ($)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={form.pastDueAmount} onChange={(e) => setField("pastDueAmount", e.target.value)} />
              </div>
            </div>

            {/* Billing period */}
            <div className="space-y-1.5">
              <Label>Billing period</Label>
              <Select value={form.billingPeriod} onValueChange={(v) => setField("billingPeriod", (v ?? "unknown") as BillingPeriod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Issue date</Label>
                <Input type="date" value={form.issueDate} onChange={(e) => setField("issueDate", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setField("dueDate", e.target.value)} />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Optional notes" rows={2} value={form.notes} onChange={(e) => setField("notes", e.target.value)} />
            </div>

            {pendingMeta && <p className="text-xs text-muted-foreground">File: {pendingMeta.fileName}</p>}
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Filing…" : "File document"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document preview */}
      <DocumentPreviewModal doc={previewDoc} open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}

function ConfidenceDot({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${color}`} /> AI confidence: {pct}%
    </span>
  );
}
