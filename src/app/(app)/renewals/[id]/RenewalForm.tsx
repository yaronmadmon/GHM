"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Loader2, Send, XCircle, TrendingUp } from "lucide-react";
import { addYears, addDays, format } from "date-fns";

interface LeaseData {
  id: string;
  rentAmount: number;
  startDate: string;
  endDate: string | null;
  leaseType: string;
  paymentDueDay: number;
  unit: { unitNumber: string; property: { name: string; address: string | null } };
  tenants: Array<{ isPrimary: boolean; tenant: { id: string; firstName: string; lastName: string; email: string | null } }>;
}

export function RenewalForm({ lease }: { lease: LeaseData }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<"renew" | "terminate" | null>(null);

  const defaultStart = lease.endDate
    ? format(addDays(new Date(lease.endDate), 1), "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");
  const defaultEnd = format(addYears(new Date(defaultStart), 1), "yyyy-MM-dd");

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [rentAmount, setRentAmount] = useState(lease.rentAmount.toString());
  const [rentIncreasePct, setRentIncreasePct] = useState("0");
  const [leaseType, setLeaseType] = useState(lease.leaseType);
  const [paymentDueDay, setPaymentDueDay] = useState(lease.paymentDueDay.toString());
  const [notes, setNotes] = useState("");

  const primaryTenant = lease.tenants.find((lt) => lt.isPrimary)?.tenant ?? lease.tenants[0]?.tenant;

  // Sync % when rent changes
  useEffect(() => {
    const newRent = parseFloat(rentAmount);
    if (!isNaN(newRent) && lease.rentAmount > 0) {
      const pct = ((newRent - lease.rentAmount) / lease.rentAmount) * 100;
      setRentIncreasePct(pct.toFixed(1));
    }
  }, [rentAmount, lease.rentAmount]);

  function applyPct(pct: string) {
    setRentIncreasePct(pct);
    const p = parseFloat(pct);
    if (!isNaN(p)) {
      setRentAmount((lease.rentAmount * (1 + p / 100)).toFixed(2));
    }
  }

  async function sendRenewal() {
    setSubmitting("renew");
    try {
      const res = await fetch(`/api/leases/${lease.id}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, rentAmount: parseFloat(rentAmount), leaseType, paymentDueDay: parseInt(paymentDueDay), notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to send renewal");
        return;
      }
      const { leaseId } = await res.json();
      toast.success("Renewal sent for tenant signature");
      router.push(`/leases/${leaseId}`);
    } finally {
      setSubmitting(null);
    }
  }

  async function sendNonRenewal() {
    setSubmitting("terminate");
    try {
      const res = await fetch(`/api/leases/${lease.id}/non-renewal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to send notice");
        return;
      }
      toast.success("Non-renewal notice sent to tenant");
      router.push("/renewals");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Current lease summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Current Lease</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Tenant</p>
              <p className="font-medium">{primaryTenant ? `${primaryTenant.firstName} ${primaryTenant.lastName}` : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Property / Unit</p>
              <p className="font-medium">{lease.unit.property.name} · Unit {lease.unit.unitNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Current Rent</p>
              <p className="font-medium">{formatCurrency(lease.rentAmount)}/mo</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Lease Type</p>
              <p className="font-medium capitalize">{lease.leaseType.replace("_", " ")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Start Date</p>
              <p className="font-medium">{formatDate(new Date(lease.startDate))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Expiry</p>
              <p className="font-medium text-amber-600">{lease.endDate ? formatDate(new Date(lease.endDate)) : "Month-to-month"}</p>
            </div>
          </div>
          {lease.tenants.length > 1 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {lease.tenants.map((lt) => (
                <Badge key={lt.tenant.id} variant="secondary" className="text-xs">
                  {lt.tenant.firstName} {lt.tenant.lastName}{lt.isPrimary ? " (primary)" : ""}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Renewal terms form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Renewal Terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">New Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">New End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">New Monthly Rent ($)</Label>
              <Input
                type="number"
                value={rentAmount}
                onChange={(e) => setRentAmount(e.target.value)}
                className="h-8 text-sm font-mono"
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Increase %
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  value={rentIncreasePct}
                  onChange={(e) => applyPct(e.target.value)}
                  className="h-8 text-sm pr-6"
                  step="0.1"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Lease Type</Label>
              <Select value={leaseType} onValueChange={(v) => v && setLeaseType(v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Term</SelectItem>
                  <SelectItem value="month_to_month">Month-to-Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Due Day</Label>
              <Input
                type="number"
                value={paymentDueDay}
                onChange={(e) => setPaymentDueDay(e.target.value)}
                className="h-8 text-sm"
                min="1"
                max="28"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Note to Tenant (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any message to include in the email to the tenant…"
              className="text-sm resize-none"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="lg:col-span-2 flex flex-col sm:flex-row gap-3 justify-between border-t pt-4">
        <Button
          variant="destructive"
          className="gap-2"
          onClick={sendNonRenewal}
          disabled={submitting !== null}
        >
          {submitting === "terminate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          Send Non-Renewal Notice
        </Button>
        <Button
          className="gap-2"
          onClick={sendRenewal}
          disabled={submitting !== null}
        >
          {submitting === "renew" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send Renewal for Signature
        </Button>
      </div>
    </div>
  );
}
