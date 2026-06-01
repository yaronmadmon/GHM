"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Plus,
  Trash2,
  X,
} from "lucide-react";

export type BillRow = {
  id: string;
  vendorId: string | null;
  vendorName: string | null;
  propertyId: string | null;
  unitId: string | null;
  documentId: string | null;
  amount: number;
  billDate: string | null;
  dueDate: string | null;
  category: string;
  description: string | null;
  notes: string | null;
  status: string;
  paidAt: string | null;
  transactionId: string | null;
  createdAt: string;
  vendor: { id: string; name: string } | null;
  property: { id: string; name: string } | null;
};

type Property = { id: string; name: string };
type Vendor = { id: string; name: string };

const STATUS_TABS = ["all", "needs_review", "approved", "paid", "rejected"] as const;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  needs_review: { label: "Needs Review", color: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-900", icon: <Clock className="h-3 w-3" /> },
  approved:     { label: "Approved",     color: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-900",   icon: <CheckCircle2 className="h-3 w-3" /> },
  paid:         { label: "Paid",         color: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-900", icon: <CheckCircle2 className="h-3 w-3" /> },
  overdue:      { label: "Overdue",      color: "bg-red-500/10 text-red-700 border-red-200 dark:text-red-300 dark:border-red-900",         icon: <AlertTriangle className="h-3 w-3" /> },
  rejected:     { label: "Rejected",     color: "bg-muted text-muted-foreground",                                                           icon: <X className="h-3 w-3" /> },
};

const CATEGORIES = ["utility", "repair", "insurance", "tax", "mortgage", "hoa", "management", "legal", "other"];

function formatAmount(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(bill: BillRow) {
  return bill.status === "approved" && bill.dueDate != null && new Date(bill.dueDate) < new Date();
}

function BillStatusBadge({ bill }: { bill: BillRow }) {
  const effectiveStatus = isOverdue(bill) ? "overdue" : bill.status;
  const cfg = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.needs_review;
  return (
    <Badge variant="outline" className={`flex items-center gap-1 text-xs ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </Badge>
  );
}

interface Props {
  initialBills: BillRow[];
  properties: Property[];
  vendors: Vendor[];
}

export function BillsClient({ initialBills, properties, vendors }: Props) {
  const [bills, setBills] = useState<BillRow[]>(initialBills);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    vendorId: "",
    vendorName: "",
    propertyId: "",
    amount: "",
    billDate: "",
    dueDate: "",
    category: "other",
    description: "",
    notes: "",
    status: "needs_review",
  });
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = bills.filter((b) => {
    if (activeTab === "all") return true;
    if (activeTab === "approved") return b.status === "approved" && !isOverdue(b);
    return b.status === activeTab;
  });

  const counts = {
    all: bills.length,
    needs_review: bills.filter((b) => b.status === "needs_review").length,
    approved: bills.filter((b) => b.status === "approved" && !isOverdue(b)).length,
    overdue: bills.filter(isOverdue).length,
    paid: bills.filter((b) => b.status === "paid").length,
    rejected: bills.filter((b) => b.status === "rejected").length,
  };

  const totalUnpaid = bills
    .filter((b) => b.status === "needs_review" || b.status === "approved" || isOverdue(b))
    .reduce((sum, b) => sum + b.amount, 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount) { toast.error("Amount is required"); return; }
    setCreating(true);
    const res = await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId: form.vendorId || null,
        vendorName: form.vendorName || null,
        propertyId: form.propertyId || null,
        amount: parseFloat(form.amount),
        billDate: form.billDate ? new Date(form.billDate).toISOString() : null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        category: form.category,
        description: form.description || null,
        notes: form.notes || null,
        status: form.status,
      }),
    });
    setCreating(false);
    if (!res.ok) { toast.error("Failed to create bill"); return; }
    const bill = await res.json();
    setBills((prev) => [bill, ...prev]);
    setDialogOpen(false);
    setForm({ vendorId: "", vendorName: "", propertyId: "", amount: "", billDate: "", dueDate: "", category: "other", description: "", notes: "", status: "needs_review" });
    toast.success("Bill added");
  }

  async function handleStatusChange(bill: BillRow, newStatus: string) {
    setActionLoading(bill.id);
    const res = await fetch(`/api/bills/${bill.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setActionLoading(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error((d as { error?: string }).error ?? "Failed to update bill");
      return;
    }
    const updated = await res.json();
    setBills((prev) => prev.map((b) => (b.id === bill.id ? updated : b)));
    if (newStatus === "paid") toast.success("Bill marked paid — expense recorded");
    else toast.success("Bill updated");
  }

  async function handleDelete(billId: string) {
    setActionLoading(billId);
    const res = await fetch(`/api/bills/${billId}`, { method: "DELETE" });
    setActionLoading(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error((d as { error?: string }).error ?? "Failed to delete bill");
      return;
    }
    setBills((prev) => prev.filter((b) => b.id !== billId));
    toast.success("Bill deleted");
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bills & Payables</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {counts.needs_review > 0 && `${counts.needs_review} need review · `}
            {counts.overdue > 0 && <span className="text-destructive">{counts.overdue} overdue · </span>}
            {formatAmount(totalUnpaid)} unpaid
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Add Bill
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              activeTab === tab
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {tab === "all" ? "All" : STATUS_CONFIG[tab]?.label ?? tab}
            {counts[tab as keyof typeof counts] > 0 && (
              <span className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${activeTab === tab ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {counts[tab as keyof typeof counts]}
              </span>
            )}
          </button>
        ))}
        {counts.overdue > 0 && (
          <button
            onClick={() => setActiveTab("approved")}
            className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-700 dark:border-red-900 dark:text-red-300"
          >
            <AlertTriangle className="h-3 w-3" /> {counts.overdue} overdue
          </button>
        )}
      </div>

      {/* Bill list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">{bills.length === 0 ? "No bills yet" : "No bills in this category"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {bills.length === 0 ? "Add a bill manually or upload one via the Document Center." : "Switch tabs to see other bills."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((bill) => {
            const overdue = isOverdue(bill);
            const loading = actionLoading === bill.id;
            const vendorLabel = bill.vendor?.name ?? bill.vendorName ?? "Unknown vendor";
            return (
              <Card key={bill.id} className={overdue ? "border-destructive/30" : ""}>
                <CardContent className="flex items-start gap-4 py-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{vendorLabel}</span>
                      {bill.description && <span className="text-xs text-muted-foreground">· {bill.description}</span>}
                      <BillStatusBadge bill={bill} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono font-semibold text-sm text-foreground">{formatAmount(bill.amount)}</span>
                      <span className="capitalize">{bill.category}</span>
                      {bill.property && <span>{bill.property.name}</span>}
                      {bill.dueDate && (
                        <span className={overdue ? "font-medium text-destructive" : ""}>
                          Due {formatDate(bill.dueDate)}
                        </span>
                      )}
                      {bill.paidAt && <span>Paid {formatDate(bill.paidAt)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {bill.status === "needs_review" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading} onClick={() => handleStatusChange(bill, "approved")}>
                        Approve
                      </Button>
                    )}
                    {(bill.status === "approved" || overdue) && (
                      <Button size="sm" className="h-7 text-xs" disabled={loading} onClick={() => handleStatusChange(bill, "paid")}>
                        Mark Paid
                      </Button>
                    )}
                    {bill.status !== "paid" && (
                      <button
                        onClick={() => handleDelete(bill.id)}
                        disabled={loading}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded"
                        title="Delete bill"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Bill</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ($) *</Label>
                <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v ?? "other" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Vendor</Label>
              <Select value={form.vendorId} onValueChange={(v) => setForm((f) => ({ ...f, vendorId: v ?? "", vendorName: "" }))}>
                <SelectTrigger><SelectValue placeholder="Select vendor or type below" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None (use name below)</SelectItem>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!form.vendorId && (
                <Input placeholder="Vendor name (e.g. PSE&G)" value={form.vendorName} onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))} />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Property (optional)</Label>
              <Select value={form.propertyId} onValueChange={(v) => setForm((f) => ({ ...f, propertyId: v ?? "" }))}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bill date</Label>
                <Input type="date" value={form.billDate} onChange={(e) => setForm((f) => ({ ...f, billDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="e.g. January water bill" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label>Start as</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v ?? "needs_review" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="needs_review">Needs Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="submit" size="sm" disabled={creating}>{creating ? "Saving…" : "Add Bill"}</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
