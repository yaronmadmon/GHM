"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DollarSign, Plus } from "lucide-react";
import { toast } from "sonner";

interface Payment {
  id: string;
  periodYear: number;
  periodMonth: number;
  amountDue: number;
  amountPaid: number;
  status: string;
  dueDate: string;
  paidDate?: string;
  paymentMethod?: string;
}

interface PaymentRequest {
  id: string;
  amount: number;
  method: string;
  status: string;
  periodYear: number;
  periodMonth: number;
  notes?: string;
  createdAt: string;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function PortalPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [leaseId, setLeaseId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", method: "ach", notes: "", periodYear: new Date().getFullYear(), periodMonth: new Date().getMonth() + 1 });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Fetch rent payments via tenant portal endpoint
    fetch("/api/portal/payments")
      .then((r) => r.json())
      .then((d) => {
        setPayments(d.payments ?? []);
        setLeaseId(d.leaseId ?? "");
        setRequests(d.requests ?? []);
      })
      .catch(() => {});
  }, []);

  async function submitRequest() {
    if (!leaseId) { toast.error("No active lease found"); return; }
    setSubmitting(true);
    const res = await fetch("/api/payment-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaseId, amount: parseFloat(form.amount), method: form.method, notes: form.notes, periodYear: form.periodYear, periodMonth: form.periodMonth }),
    });
    setSubmitting(false);
    if (!res.ok) { toast.error("Failed to submit"); return; }
    const req = await res.json();
    setRequests((prev) => [req, ...prev]);
    setOpen(false);
    toast.success("Payment request submitted");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payments</h1>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Submit Payment
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Rent History</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment history yet.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{MONTHS[p.periodMonth - 1]} {p.periodYear}</p>
                    <p className="text-xs text-muted-foreground">Due {formatDate(new Date(p.dueDate))}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatCurrency(Number(p.amountPaid))} / {formatCurrency(Number(p.amountDue))}</p>
                    <Badge variant={p.status === "paid" ? "default" : p.status === "overdue" ? "destructive" : "secondary"} className="text-xs">
                      {p.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {requests.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Submitted Payment Requests</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{formatCurrency(Number(r.amount))} via {r.method}</p>
                    <p className="text-xs text-muted-foreground">{MONTHS[r.periodMonth - 1]} {r.periodYear}</p>
                  </div>
                  <Badge variant={r.status === "confirmed" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Month</Label>
                <Select value={String(form.periodMonth)} onValueChange={(v) => setForm((f) => ({ ...f, periodMonth: parseInt(v ?? "1") }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Input type="number" value={form.periodYear} onChange={(e) => setForm((f) => ({ ...f, periodYear: parseInt(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" placeholder="1500.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v ?? "ach" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["ach", "check", "cash", "zelle", "venmo", "other"].map((m) => <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <Button onClick={submitRequest} disabled={submitting || !form.amount} className="w-full">
              {submitting ? "Submitting..." : "Submit Payment Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
