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
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-900",
  partial: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-900",
  overdue: "bg-red-500/10 text-red-700 border-red-200 dark:text-red-300 dark:border-red-900",
  pending: "bg-muted text-muted-foreground",
  not_generated: "bg-muted/50 text-muted-foreground/60",
};

interface ChargeBreakdown { name: string; category: string; amount: number; }

interface BulkItem {
  leaseId: string;
  unit: { id: string; unitNumber: string; property: { id: string; name: string } };
  tenants: { id: string; firstName: string; lastName: string }[];
  rentAmount: string;
  monthlyDue: number;
  chargeBreakdown?: ChargeBreakdown[];
  lateFeeAmount?: number | null;
  lateFeGraceDays?: number | null;
  lateFeeTriggerDate?: string | null;
  dueDateForPeriod?: string | null;
  payment: { id: string; amountPaid: string; amountDue: string; status: string } | null;
  status: string;
  balance: number;
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
    if (dir === 1) {
      if (month === 12) {
        setYear((y) => y + 1);
        setMonth(1);
      } else {
        setMonth((m) => m + 1);
      }
    } else if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/rent-payments/bulk-view?year=${year}&month=${month}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
    }
    setLoading(false);
  }

  async function generateMonth() {
    const res = await fetch("/api/rent-payments/generate-month", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month }),
    });
    if (res.ok) {
      toast.success("Payment records generated");
      load();
    } else {
      toast.error("Failed to generate records");
    }
  }

  async function handleRecord(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!recordDialog) return;
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/rent-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leaseId: recordDialog.leaseId,
        periodYear: year,
        periodMonth: month,
        amountDue: Number(recordDialog.monthlyDue ?? recordDialog.rentAmount),
        amountPaid: parseFloat(form.get("amount") as string),
        dueDate: new Date(year, month - 1, 1).toISOString(),
        paymentMethod: form.get("method"),
        notes: form.get("notes") || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Payment recorded");
      setRecordDialog(null);
      load();
    } else {
      toast.error("Failed to record payment");
    }
  }

  useEffect(() => {
    load();
  }, [year, month]);

  const totalExpected = items.reduce((s, i) => s + Number(i.monthlyDue ?? i.rentAmount), 0);
  const totalCollected = items.reduce((s, i) => s + (i.payment ? parseFloat(String(i.payment.amountPaid)) : 0), 0);
  const totalOutstanding = items.reduce((s, i) => s + Math.max(0, Number(i.balance ?? 0)), 0);

  return (
    <div className="page-shell page-stack">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">Collections</p>
          <h1 className="page-title mt-2">Rent</h1>
          <p className="mt-2 text-sm text-muted-foreground">Monthly rent records and ledger balances.</p>
        </div>
        <Button size="sm" variant="outline" onClick={generateMonth} className="gap-2">
          <CalendarDays className="h-4 w-4" />
          Generate records
        </Button>
      </div>

      <div className="surface-panel p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="w-40 text-center text-sm font-semibold md:text-base">{monthName}</span>
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(1)} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[36rem]">
            <div className="rounded-md border bg-background/55 p-3">
              <p className="text-xs text-muted-foreground">Expected</p>
              <p className="mt-1 font-mono font-semibold">{formatCurrency(totalExpected)}</p>
            </div>
            <div className="rounded-md border bg-background/55 p-3">
              <p className="text-xs text-muted-foreground">Collected</p>
              <p className="mt-1 font-mono font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(totalCollected)}</p>
            </div>
            <div className="rounded-md border bg-background/55 p-3">
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="mt-1 font-mono font-semibold text-red-700 dark:text-red-300">{formatCurrency(totalOutstanding)}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="surface-panel p-8 text-sm text-muted-foreground">Loading rent records...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <CalendarDays className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="font-heading text-3xl font-semibold">No active leases found</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">Create active leases to begin generating rent records.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {items.map((item) => (
              <article key={item.leaseId} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {item.tenants[0] ? (
                      <Link href={`/tenants/${item.tenants[0].id}`} className="block truncate text-sm font-semibold hover:text-primary">
                        {item.tenants[0].firstName} {item.tenants[0].lastName}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-semibold">No tenant</p>
                    )}
                    <Link href={`/leases/${item.leaseId}`} className="block truncate text-xs text-muted-foreground hover:text-primary">
                      {item.unit.property.name} - Unit {item.unit.unitNumber}
                    </Link>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setRecordDialog(item)}>
                    <Plus className="h-3 w-3" />
                    Record
                  </Button>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={`border text-xs ${STATUS_STYLES[item.status] ?? ""}`}>
                      {item.status.replace("_", " ")}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.payment ? `${formatCurrency(parseFloat(String(item.payment.amountPaid)))} / ` : ""}
                      {formatCurrency(Number(item.monthlyDue ?? item.rentAmount))}
                    </span>
                  </div>
                  {/* Charge breakdown */}
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <span>Rent: {formatCurrency(Number(item.rentAmount))}</span>
                    {item.chargeBreakdown?.map((c) => (
                      <span key={c.name} className="ml-2 text-blue-700 dark:text-blue-400">· {c.name}: +{formatCurrency(c.amount)}</span>
                    ))}
                    {item.lateFeeAmount && item.lateFeeAmount > 0 && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">· Late fee: {formatCurrency(item.lateFeeAmount)} (after {item.lateFeGraceDays ?? 5}d)</span>
                    )}
                  </div>
                </div>
                <p className={`mt-1 font-mono text-xs ${item.balance > 0 ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}`}>
                  Ledger balance: {formatCurrency(item.balance)}
                </p>
              </article>
            ))}
          </div>

          <div className="data-table-shell hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tenant</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Unit</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Charges</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Due</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Paid</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.leaseId} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {item.tenants[0] ? (
                        <Link href={`/tenants/${item.tenants[0].id}`} className="hover:text-primary">
                          {item.tenants[0].firstName} {item.tenants[0].lastName}
                        </Link>
                      ) : "No tenant"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <Link href={`/leases/${item.leaseId}`} className="hover:text-primary">
                        {item.unit.property.name} - Unit {item.unit.unitNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {item.dueDateForPeriod && (
                          <div className="font-medium text-foreground/70">
                            Due: {new Date(item.dueDateForPeriod).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                        )}
                        <div>Rent: <span className="font-mono">{formatCurrency(Number(item.rentAmount))}</span></div>
                        {item.chargeBreakdown?.map((c) => (
                          <div key={c.name} className="text-blue-700 dark:text-blue-400">
                            {c.name}: <span className="font-mono">+{formatCurrency(c.amount)}</span>
                          </div>
                        ))}
                        {item.lateFeeAmount && item.lateFeeAmount > 0 && (
                          <div className={`${item.status === "overdue" || item.status === "pending" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                            Late fee {formatCurrency(item.lateFeeAmount)} if unpaid by{" "}
                            {item.lateFeeTriggerDate
                              ? new Date(item.lateFeeTriggerDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                              : `day ${item.lateFeGraceDays ?? 5}`}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{formatCurrency(Number(item.monthlyDue ?? item.rentAmount))}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {item.payment ? formatCurrency(parseFloat(String(item.payment.amountPaid))) : "-"}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${item.balance > 0 ? "font-medium text-red-700 dark:text-red-300" : "text-muted-foreground"}`}>
                      {formatCurrency(item.balance)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`border text-xs ${STATUS_STYLES[item.status] ?? ""}`}>{item.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setRecordDialog(item)}>
                        <Plus className="h-3 w-3" />
                        Record
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog open={!!recordDialog} onOpenChange={(open) => !open && setRecordDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record rent payment</DialogTitle>
          </DialogHeader>
          {recordDialog && (
            <form onSubmit={handleRecord} className="space-y-4">
              <div>
                <p className="text-sm font-medium">
                  {recordDialog.tenants[0]?.firstName} {recordDialog.tenants[0]?.lastName} — {monthName}
                </p>
                <div className="mt-1.5 space-y-0.5 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Rent</span><span className="font-mono">{formatCurrency(Number(recordDialog.rentAmount))}</span></div>
                  {recordDialog.chargeBreakdown?.map((c) => (
                    <div key={c.name} className="flex justify-between text-blue-700 dark:text-blue-400">
                      <span>{c.name}</span><span className="font-mono">+{formatCurrency(c.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-1 font-medium text-foreground">
                    <span>Total due</span><span className="font-mono">{formatCurrency(Number(recordDialog.monthlyDue ?? recordDialog.rentAmount))}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input name="amount" type="number" step="0.01" defaultValue={String(recordDialog.monthlyDue ?? recordDialog.rentAmount)} required />
              </div>
              <div className="space-y-2">
                <Label>Payment method</Label>
                <Select name="method" defaultValue="cash">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["cash", "check", "ach", "zelle", "venmo", "other"].map((method) => (
                      <SelectItem key={method} value={method}>{method.charAt(0).toUpperCase() + method.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input name="notes" placeholder="Check #1234" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={saving} className="flex-1">{saving ? "Saving..." : "Record payment"}</Button>
                <Button type="button" variant="outline" onClick={() => setRecordDialog(null)}>Cancel</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
