"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  partial: "bg-blue-500/10 text-blue-700 border-blue-200",
  overdue: "bg-red-500/10 text-red-700 border-red-200",
  pending: "bg-muted text-muted-foreground",
  not_generated: "bg-muted/50 text-muted-foreground/50",
};

interface BulkItem {
  leaseId: string;
  unit: { id: string; unitNumber: string; property: { id: string; name: string } };
  tenants: { id: string; firstName: string; lastName: string }[];
  rentAmount: string;
  payment: { id: string; amountPaid: string; amountDue: string; status: string } | null;
  status: string;
}

export default function RentPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<BulkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordDialog, setRecordDialog] = useState<BulkItem | null>(null);
  const [saving, setSaving] = useState(false);

  const monthName = new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function navigate(dir: 1 | -1) {
    if (dir === 1) { if (month === 12) { setYear((y) => y + 1); setMonth(1); } else setMonth((m) => m + 1); }
    else { if (month === 1) { setYear((y) => y - 1); setMonth(12); } else setMonth((m) => m - 1); }
  }

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/rent-payments/bulk-view?year=${year}&month=${month}`);
    if (res.ok) { const data = await res.json(); setItems(data.items); }
    setLoading(false);
  }

  async function generateMonth() {
    const res = await fetch("/api/rent-payments/generate-month", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month }),
    });
    if (res.ok) { toast.success("Payment records generated"); load(); }
    else toast.error("Failed to generate");
  }

  async function handleRecord(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!recordDialog) return;
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/rent-payments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leaseId: recordDialog.leaseId,
        periodYear: year, periodMonth: month,
        amountDue: parseFloat(String(recordDialog.rentAmount)),
        amountPaid: parseFloat(form.get("amount") as string),
        dueDate: new Date(year, month - 1, 1).toISOString(),
        paymentMethod: form.get("method"),
        notes: form.get("notes") || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Payment recorded!"); setRecordDialog(null); load(); }
    else toast.error("Failed to record payment");
  }

  useEffect(() => { load(); }, [year, month]);

  const totalExpected = items.reduce((s, i) => s + parseFloat(String(i.rentAmount)), 0);
  const totalCollected = items.reduce((s, i) => s + (i.payment ? parseFloat(String(i.payment.amountPaid)) : 0), 0);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Rent</h1>
        <Button size="sm" variant="outline" onClick={generateMonth} className="text-xs md:text-sm">
          Generate records
        </Button>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold w-36 text-center text-sm md:text-base">{monthName}</span>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="flex gap-3 text-sm ml-1">
          <span className="text-muted-foreground">Expected: <strong>{formatCurrency(totalExpected)}</strong></span>
          <span className="text-muted-foreground">Collected: <strong className="text-emerald-600">{formatCurrency(totalCollected)}</strong></span>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><p>No active leases found.</p></div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {items.map((item) => (
              <div key={item.leaseId} className="rounded-lg border p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {item.tenants[0] ? (
                    <Link href={`/tenants/${item.tenants[0].id}`} className="font-medium text-sm truncate block hover:text-primary transition-colors">
                      {item.tenants[0].firstName} {item.tenants[0].lastName}
                    </Link>
                  ) : (
                    <p className="font-medium text-sm truncate">—</p>
                  )}
                  <Link href={`/leases/${item.leaseId}`} className="text-xs text-muted-foreground truncate hover:text-primary transition-colors block">
                    {item.unit.property.name} · Unit {item.unit.unitNumber}
                  </Link>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge className={`text-xs border ${STATUS_STYLES[item.status] ?? ""}`}>
                      {item.status.replace("_", " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {item.payment ? `${formatCurrency(parseFloat(String(item.payment.amountPaid)))} / ` : ""}
                      {formatCurrency(parseFloat(String(item.rentAmount)))}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs shrink-0" onClick={() => setRecordDialog(item)}>
                  <Plus className="h-3 w-3" />Record
                </Button>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tenant</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Unit</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Due</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Paid</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.leaseId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {item.tenants[0] ? (
                        <Link href={`/tenants/${item.tenants[0].id}`} className="hover:text-primary transition-colors">
                          {item.tenants[0].firstName} {item.tenants[0].lastName}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <Link href={`/leases/${item.leaseId}`} className="hover:text-primary transition-colors">
                        {item.unit.property.name} · Unit {item.unit.unitNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(parseFloat(String(item.rentAmount)))}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {item.payment ? formatCurrency(parseFloat(String(item.payment.amountPaid))) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs border ${STATUS_STYLES[item.status] ?? ""}`}>{item.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setRecordDialog(item)}>
                        <Plus className="h-3 w-3" />Record
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={!!recordDialog} onOpenChange={(o) => !o && setRecordDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
          {recordDialog && (
            <form onSubmit={handleRecord} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {recordDialog.tenants[0]?.firstName} {recordDialog.tenants[0]?.lastName} — {monthName}
              </p>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input name="amount" type="number" step="0.01" defaultValue={String(recordDialog.rentAmount)} required />
              </div>
              <div className="space-y-2">
                <Label>Payment method</Label>
                <Select name="method" defaultValue="cash">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["cash", "check", "ach", "zelle", "venmo", "other"].map((m) => (
                      <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input name="notes" placeholder="Check #1234…" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={saving} className="flex-1">{saving ? "Saving…" : "Record payment"}</Button>
                <Button type="button" variant="outline" onClick={() => setRecordDialog(null)}>Cancel</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
