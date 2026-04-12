"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Trash2, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface AppDocument {
  id: string;
  name: string;
  url: string;
  docType: string;
  createdAt: string;
}

const REQUIRED_TYPES = ["pay_stub", "id", "bank_statement"] as const;
const TYPE_LABELS: Record<string, string> = {
  pay_stub: "Pay Stub",
  id: "Government ID",
  bank_statement: "Bank Statement",
  other: "Other",
};

interface Props {
  applicationId: string;
  onDocsChange?: (docs: AppDocument[]) => void;
}

export function DocumentsSection({ applicationId, onDocsChange }: Props) {
  const [docs, setDocs] = useState<AppDocument[]>([]);
  const [form, setForm] = useState({ name: "", url: "", docType: "pay_stub" });
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch(`/api/applications/${applicationId}/documents`)
      .then((r) => r.json())
      .then((data) => {
        setDocs(Array.isArray(data) ? data : []);
        onDocsChange?.(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, [applicationId]);

  async function handleAdd() {
    if (!form.name.trim() || !form.url.trim()) { toast.error("Name and URL are required"); return; }
    setAdding(true);
    const res = await fetch(`/api/applications/${applicationId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setAdding(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed to add"); return; }
    const doc = await res.json();
    const updated = [...docs, doc];
    setDocs(updated);
    onDocsChange?.(updated);
    setForm({ name: "", url: "", docType: "pay_stub" });
    setShowForm(false);
    toast.success("Document added");
  }

  async function handleDelete(docId: string) {
    const res = await fetch(`/api/applications/${applicationId}/documents/${docId}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to remove"); return; }
    const updated = docs.filter((d) => d.id !== docId);
    setDocs(updated);
    onDocsChange?.(updated);
    toast.success("Document removed");
  }

  const coveredTypes = new Set(docs.map((d) => d.docType));

  return (
    <div className="space-y-3">
      {/* Required types checklist */}
      <div className="flex flex-wrap gap-2">
        {REQUIRED_TYPES.map((t) => (
          <div key={t} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${coveredTypes.has(t) ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
            {coveredTypes.has(t) ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {TYPE_LABELS[t]}
          </div>
        ))}
      </div>

      {/* Document list */}
      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents on file.</p>
      ) : (
        <div className="space-y-1.5">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <Badge variant="outline" className="text-xs mt-0.5">{TYPE_LABELS[doc.docType] ?? doc.docType}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="h-3.5 w-3.5" /></Button>
                </a>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(doc.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <div className="border rounded-lg p-3 space-y-3 bg-muted/10">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Document Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Oct 2024 Pay Stub" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={form.docType} onValueChange={(v) => setForm((f) => ({ ...f, docType: v ?? "other" }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Document URL (Google Drive, Dropbox, etc.)</Label>
            <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://drive.google.com/..." className="h-8 text-sm" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={adding}>{adding ? "Adding..." : "Add Document"}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5" />Add Document
        </Button>
      )}
    </div>
  );
}
