"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Printer, Mail, Send } from "lucide-react";
import { toast } from "sonner";

// ─── Types mirroring Prisma return shape ─────────────────────────────────────

interface RentPayment {
  id: string;
  periodYear: number;
  periodMonth: number;
  amountDue: unknown;
  amountPaid: unknown;
  status: string;
  dueDate: Date;
  paidAt?: Date | null;
  paymentMethod?: string | null;
  notes?: string | null;
}

interface Transaction {
  id: string;
  type: string;
  category: string;
  amount: unknown;
  date: Date;
  description?: string | null;
  paymentMethod?: string | null;
}

interface Lease {
  id: string;
  startDate: Date;
  endDate?: Date | null;
  rentAmount: unknown;
  depositAmount?: unknown | null;
  depositPaid: boolean;
  rentPayments: RentPayment[];
  transactions: Transaction[];
  unit: {
    unitNumber: string;
    property: {
      name: string;
      addressLine1: string;
      city: string;
      state: string;
      zip: string;
    };
  };
}

interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
}

interface Props {
  tenant: Tenant;
  activeLease: Lease | null;
  orgName: string;
  tenantId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: unknown) {
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ─── Merge payments + transactions into a single chronological ledger ─────────

interface LedgerRow {
  date: Date;
  description: string;
  charges: number;
  payments: number;
  balance: number;
  status?: string;
}

function buildLedger(lease: Lease): LedgerRow[] {
  const rows: Omit<LedgerRow, "balance">[] = [];

  // Rent payments
  for (const p of lease.rentPayments) {
    // Row for the charge
    rows.push({
      date: new Date(p.dueDate),
      description: `Rent — ${MONTHS[p.periodMonth - 1]} ${p.periodYear}${p.notes ? ` (${p.notes})` : ""}`,
      charges: Number(p.amountDue),
      payments: 0,
      status: p.status,
    });
    // Row for the payment received (if any)
    const paid = Number(p.amountPaid);
    if (paid > 0) {
      rows.push({
        date: p.paidAt ? new Date(p.paidAt) : new Date(p.dueDate),
        description: `Payment received${p.paymentMethod ? ` (${p.paymentMethod})` : ""}`,
        charges: 0,
        payments: paid,
        status: "paid",
      });
    }
  }

  // Transactions (fees, legal charges, etc.)
  for (const t of lease.transactions) {
    const amt = Number(t.amount);
    const desc = t.description ?? `${t.category.replace(/_/g, " ")} — ${t.type}`;
    rows.push({
      date: new Date(t.date),
      description: desc.replace(/^\[Imported\] /, ""),
      charges: t.type === "income" ? amt : 0,
      payments: t.type === "expense" ? amt : 0,
    });
  }

  // Sort by date
  rows.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calculate running balance
  let balance = 0;
  return rows.map((r) => {
    balance = balance + r.charges - r.payments;
    return { ...r, balance };
  });
}

// ─── Email Sheet ──────────────────────────────────────────────────────────────

function EmailSheet({ tenantId, tenantName, open, onClose }: { tenantId: string; tenantName: string; open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!email.trim()) { toast.error("Recipient email is required"); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/ledger/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: email.trim(), recipientName: name.trim() || undefined, message: message.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to send"); return; }
      toast.success(`Ledger sent to ${email}`);
      onClose();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Send Ledger by Email</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Send the complete ledger for <strong>{tenantName}</strong> to an attorney, social worker, or housing authority.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recipient Email *</label>
            <Input placeholder="attorney@lawfirm.com" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recipient Name</label>
            <Input placeholder="John Smith, Esq." value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Message (optional)</label>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/40"
              rows={3}
              placeholder="Please find the attached rent ledger for your review…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <Button className="w-full gap-2" onClick={handleSend} disabled={sending}>
            <Send className="h-4 w-4" />
            {sending ? "Sending…" : "Send Ledger"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function LedgerView({ tenant, activeLease, orgName, tenantId }: Props) {
  const [emailOpen, setEmailOpen] = useState(false);
  const tenantName = `${tenant.firstName} ${tenant.lastName}`;
  const rows = activeLease ? buildLedger(activeLease) : [];
  const totalCharges = rows.reduce((s, r) => s + r.charges, 0);
  const totalPayments = rows.reduce((s, r) => s + r.payments, 0);
  const currentBalance = totalCharges - totalPayments;
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <>
      {/* Screen-only toolbar — hidden when printing */}
      <div className="print:hidden bg-background border-b px-4 md:px-6 h-14 flex items-center gap-3 sticky top-0 z-10">
        <Link href={`/tenants/${tenantId}`}>
          <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>
        </Link>
        <span className="text-sm font-medium flex-1 truncate">Ledger — {tenantName}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setEmailOpen(true)}>
            <Mail className="h-4 w-4" />Send by Email
          </Button>
          <Button size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Document — visible on screen and when printing */}
      <div className="ledger-document max-w-4xl mx-auto px-6 py-8 md:py-12 print:px-0 print:py-0 print:max-w-none">
        {/* Letterhead */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-foreground/20">
          <div>
            <h1 className="text-2xl font-bold">{orgName}</h1>
            <p className="text-sm text-muted-foreground mt-1">Tenant Rent Ledger</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Generated: {today}</p>
            <p className="text-xs mt-1">Confidential — For authorized use only</p>
          </div>
        </div>

        {/* Tenant + Property info */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tenant</p>
            <p className="font-semibold text-lg">{tenantName}</p>
            {tenant.email && <p className="text-sm text-muted-foreground">{tenant.email}</p>}
            {tenant.phone && <p className="text-sm text-muted-foreground">{tenant.phone}</p>}
          </div>
          {activeLease && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Property</p>
              <p className="font-semibold">{activeLease.unit.property.name}</p>
              <p className="text-sm text-muted-foreground">{activeLease.unit.property.addressLine1}, Unit {activeLease.unit.unitNumber}</p>
              <p className="text-sm text-muted-foreground">{activeLease.unit.property.city}, {activeLease.unit.property.state} {activeLease.unit.property.zip}</p>
              <p className="text-sm mt-1">
                Lease: {fmtDate(activeLease.startDate)} – {activeLease.endDate ? fmtDate(activeLease.endDate) : "Month-to-month"}
              </p>
              <p className="text-sm">Monthly rent: {fmt(activeLease.rentAmount)}</p>
            </div>
          )}
        </div>

        {/* Summary boxes */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="border rounded-lg p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Total Charged</p>
            <p className="text-xl font-bold font-mono">{fmt(totalCharges)}</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Total Paid</p>
            <p className="text-xl font-bold font-mono text-emerald-600">{fmt(totalPayments)}</p>
          </div>
          <div className={`border-2 rounded-lg p-4 text-center ${currentBalance > 0 ? "border-destructive/40 bg-destructive/5" : "border-emerald-500/40 bg-emerald-50/30"}`}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Balance Due</p>
            <p className={`text-xl font-bold font-mono ${currentBalance > 0 ? "text-destructive" : "text-emerald-600"}`}>{fmt(currentBalance)}</p>
          </div>
        </div>

        {/* Ledger table */}
        {rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No ledger records found.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-foreground/20">
                <th className="text-left py-2 pr-4 font-semibold text-xs uppercase tracking-wide">Date</th>
                <th className="text-left py-2 pr-4 font-semibold text-xs uppercase tracking-wide">Description</th>
                <th className="text-right py-2 pr-4 font-semibold text-xs uppercase tracking-wide">Charges</th>
                <th className="text-right py-2 pr-4 font-semibold text-xs uppercase tracking-wide">Payments</th>
                <th className="text-right py-2 font-semibold text-xs uppercase tracking-wide">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={`border-b border-foreground/10 ${row.status === "overdue" ? "bg-destructive/5" : ""}`}>
                  <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">{fmtDate(row.date)}</td>
                  <td className="py-2 pr-4">
                    {row.description}
                    {row.status && row.status !== "paid" && row.charges > 0 && (
                      <span className={`ml-2 text-xs font-medium ${row.status === "overdue" ? "text-destructive" : "text-muted-foreground"}`}>
                        [{row.status}]
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono">
                    {row.charges > 0 ? fmt(row.charges) : "—"}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-emerald-700">
                    {row.payments > 0 ? fmt(row.payments) : "—"}
                  </td>
                  <td className={`py-2 text-right font-mono font-semibold ${row.balance > 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {fmt(row.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground/20 font-bold">
                <td colSpan={2} className="py-3 text-sm font-semibold">Total</td>
                <td className="py-3 text-right font-mono">{fmt(totalCharges)}</td>
                <td className="py-3 text-right font-mono text-emerald-700">{fmt(totalPayments)}</td>
                <td className={`py-3 text-right font-mono ${currentBalance > 0 ? "text-destructive" : "text-emerald-600"}`}>{fmt(currentBalance)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t text-xs text-muted-foreground space-y-1">
          <p>This ledger was prepared by <strong>{orgName}</strong> on {today}.</p>
          <p>All figures are in USD. This document may be used as evidence in legal proceedings.</p>
          <p className="mt-3 font-medium">Authorized signature: _______________________________  Date: ______________</p>
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .ledger-document { display: block !important; }
          .print\\:hidden { display: none !important; }
          @page { margin: 1in; size: letter; }
        }
      `}</style>

      <EmailSheet tenantId={tenantId} tenantName={tenantName} open={emailOpen} onClose={() => setEmailOpen(false)} />
    </>
  );
}
