"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Download, CheckCircle, AlertTriangle, FileSpreadsheet, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

// ─── Manual Import ─────────────────────────────────────────────────────────────

type ImportEntity = "tenants" | "properties" | "transactions";

const FIELD_DEFS: Record<ImportEntity, { field: string; label: string; required?: boolean }[]> = {
  tenants: [
    { field: "firstName", label: "First Name", required: true },
    { field: "lastName", label: "Last Name", required: true },
    { field: "email", label: "Email" },
    { field: "phone", label: "Phone" },
  ],
  properties: [
    { field: "name", label: "Name", required: true },
    { field: "address", label: "Address", required: true },
    { field: "city", label: "City" },
    { field: "state", label: "State" },
    { field: "zip", label: "ZIP" },
    { field: "type", label: "Type" },
  ],
  transactions: [
    { field: "date", label: "Date", required: true },
    { field: "amount", label: "Amount", required: true },
    { field: "type", label: "Type (income/expense)", required: true },
    { field: "category", label: "Category" },
    { field: "description", label: "Description" },
  ],
};

// ─── Smart Import (Migration CTA) ────────────────────────────────────────────

function SmartImportTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-8 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mx-auto">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold">Migration Center</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Upload a tenant ledger from Buildium, AppFolio, Cozy, Rentec, or any spreadsheet. AI extracts everything — names, leases, deposits, balances, and payment history — automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
          {["Buildium", "AppFolio", "Cozy", "Rentec", "Custom CSV/Excel"].map((p) => (
            <span key={p} className="px-2.5 py-1 rounded-full bg-muted border">{p}</span>
          ))}
        </div>
        <Link href="/migration">
          <Button size="lg" className="gap-2 mt-2">
            Open Migration Center <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        The migration center lets you review and edit extracted data before importing, detect conflicts, and track progress.
      </p>
    </div>
  );
}

// ─── Manual Import Tab ────────────────────────────────────────────────────────

function ManualImportTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [entity, setEntity] = useState<ImportEntity>("tenants");
  const [phase, setPhase] = useState<"upload" | "map" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [results, setResults] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/import?action=parse", { method: "POST", body: fd });
    setLoading(false);
    if (!res.ok) { toast.error("Failed to parse file"); return; }
    const data = await res.json();
    setHeaders(data.headers);
    setRows(data.sample);
    const auto: Record<string, string> = {};
    for (const def of FIELD_DEFS[entity]) {
      const match = data.headers.find((h: string) =>
        h.toLowerCase().replace(/[\s_]/g, "") === def.field.toLowerCase() ||
        h.toLowerCase().includes(def.label.toLowerCase().split(" ")[0])
      );
      if (match) auto[def.field] = match;
    }
    setMapping(auto);
    setPhase("map");
  }

  async function handleCommit() {
    setLoading(true);
    const res = await fetch("/api/import?action=commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity, mapping, rows }),
    });
    setLoading(false);
    if (!res.ok) { toast.error("Import failed"); return; }
    const data = await res.json();
    setResults(data);
    setPhase("done");
    toast.success(`Imported ${data.imported} records`);
  }

  return (
    <div className="space-y-6">
      {phase === "upload" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Import as</Label>
            <Select value={entity} onValueChange={(v) => setEntity(v as ImportEntity)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tenants">Tenants</SelectItem>
                <SelectItem value="properties">Properties</SelectItem>
                <SelectItem value="transactions">Transactions</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-muted/50 transition-colors">
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Click to upload CSV or Excel file</p>
            <p className="text-sm text-muted-foreground mt-1">Supports .csv and .xlsx</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleUpload} />
          {loading && <p className="text-sm text-muted-foreground">Parsing file...</p>}
        </div>
      )}

      {phase === "map" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Map your file columns to the appropriate fields. Required fields are marked with *.</p>
          <div className="space-y-3">
            {FIELD_DEFS[entity].map((def) => (
              <div key={def.field} className="flex items-center gap-4">
                <Label className="w-40 shrink-0">{def.label}{def.required ? " *" : ""}</Label>
                <Select value={mapping[def.field] ?? "__skip"} onValueChange={(v) => setMapping((m) => ({ ...m, [def.field]: (v === "__skip" || !v) ? "" : v }))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Skip this field" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip">Skip this field</SelectItem>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          {rows.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Preview (first 3 rows)</p>
              <div className="overflow-x-auto rounded border text-xs">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>{headers.map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t">
                        {headers.map((h) => <td key={h} className="px-3 py-2">{row[h]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={handleCommit} disabled={loading}>{loading ? "Importing..." : `Import ${entity}`}</Button>
            <Button variant="outline" onClick={() => { setPhase("upload"); setHeaders([]); setRows([]); setMapping({}); }}>Cancel</Button>
          </div>
        </div>
      )}

      {phase === "done" && results && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
            <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="font-medium text-sm">Import complete</p>
              <p className="text-sm text-muted-foreground">{results.imported} imported · {results.skipped} skipped</p>
            </div>
          </div>
          {results.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-yellow-500" /> Errors</p>
              {results.errors.map((e, i) => <p key={i} className="text-xs text-muted-foreground pl-5">{e}</p>)}
            </div>
          )}
          <Button variant="outline" onClick={() => { setPhase("upload"); setResults(null); }}>Import more</Button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportExportPage() {
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState("excel");

  async function handleExport() {
    setExporting(true);
    const res = await fetch(`/api/export?format=${exportFormat}&entities=properties,tenants,leases,payments,transactions`);
    setExporting(false);
    if (!res.ok) { toast.error("Export failed"); return; }
    if (exportFormat === "excel") {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ghm-export-${new Date().toISOString().split("T")[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } else {
      const data = await res.json() as Record<string, string>;
      for (const [filename, content] of Object.entries(data)) {
        const blob = new Blob([content], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      }
      toast.success("CSV files downloaded");
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4 md:space-y-6">
      <h1 className="text-2xl font-semibold">Import & Export</h1>

      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" />Export Data</CardTitle>
          <CardDescription>Download all your data as Excel or CSV files.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-4">
          <div className="space-y-1.5">
            <Label>Format</Label>
            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v ?? "excel")}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV (multiple files)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleExport} disabled={exporting}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {exporting ? "Exporting..." : "Export All Data"}
          </Button>
        </CardContent>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Import Data</CardTitle>
          <CardDescription>Bring in tenants and data from any property management platform.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="smart">
            <TabsList className="mb-6">
              <TabsTrigger value="smart" className="gap-2">
                <Sparkles className="h-3.5 w-3.5" />Smart Import (AI)
              </TabsTrigger>
              <TabsTrigger value="manual">Manual / CSV mapping</TabsTrigger>
            </TabsList>
            <TabsContent value="smart">
              <SmartImportTab />
            </TabsContent>
            <TabsContent value="manual">
              <ManualImportTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
