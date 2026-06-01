"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";

type TenantPaymentPeriod = {
  periodYear: number;
  periodMonth: number;
  amountDue: number;
  amountPaid: number;
  status?: string | null;
};

type TenantPaymentButtonProps = {
  leaseId: string;
  tenantName: string;
  monthlyDue: number;
  paymentDueDay?: number | null;
  payments?: TenantPaymentPeriod[];
  periodYear?: number;
  periodMonth?: number;
  buttonLabel?: string;
  className?: string;
  size?: "xs" | "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
};

const PAYMENT_METHODS = ["cash", "check", "ach", "zelle", "venmo", "money_order", "other"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function inputDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function rentDueDate(year: number, month: number, paymentDueDay?: number | null) {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(paymentDueDay ?? 1, 1), lastDay);
  return new Date(year, month - 1, day, 12);
}

function toIsoDate(dateValue: string) {
  return new Date(`${dateValue}T12:00:00`).toISOString();
}

export function TenantPaymentButton({
  leaseId,
  tenantName,
  monthlyDue,
  paymentDueDay,
  payments = [],
  periodYear,
  periodMonth,
  buttonLabel = "Add payment",
  className,
  size = "sm",
  variant = "default",
}: TenantPaymentButtonProps) {
  const router = useRouter();
  const [initialDate] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(periodYear ?? initialDate.getFullYear());
  const [month, setMonth] = useState(periodMonth ?? initialDate.getMonth() + 1);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(inputDate(initialDate));
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedPayment = payments.find((payment) => payment.periodYear === year && payment.periodMonth === month);
  const amountDue = Number(selectedPayment?.amountDue ?? monthlyDue);
  const alreadyPaid = Number(selectedPayment?.amountPaid ?? 0);
  const remaining = Math.max(0, Math.round((amountDue - alreadyPaid) * 100) / 100);
  const baseYear = periodYear ?? initialDate.getFullYear();
  const years = [baseYear - 1, baseYear, baseYear + 1];

  useEffect(() => {
    if (!open) return;
    setAmount(remaining > 0 ? remaining.toFixed(2) : "");
  }, [open, year, month, remaining]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Payment amount must be greater than zero");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/rent-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaseId,
          periodYear: year,
          periodMonth: month,
          amountDue,
          amountPaid: parsedAmount,
          dueDate: rentDueDate(year, month, paymentDueDay).toISOString(),
          paidAt: toIsoDate(paidAt),
          paymentMethod: method,
          notes: notes.trim() || undefined,
          addToExisting: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error(typeof data?.error === "string" ? data.error : "Failed to record payment");
        return;
      }

      toast.success("Tenant payment updated");
      setOpen(false);
      setNotes("");
      router.refresh();
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size={size} variant={variant} className={className} onClick={() => setOpen(true)}>
        <CreditCard className="h-4 w-4" />
        {buttonLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record tenant payment</DialogTitle>
            <DialogDescription>
              Update the rent record and tenant ledger for {tenantName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 rounded-md border bg-muted/35 p-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Due</p>
                <p className="mt-1 font-mono font-semibold">{formatCurrency(amountDue)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Collected</p>
                <p className="mt-1 font-mono font-semibold">{formatCurrency(alreadyPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="mt-1 font-mono font-semibold">{formatCurrency(remaining)}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Period</Label>
                <Select value={String(month)} onValueChange={(value) => setMonth(Number(value ?? month))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((label, index) => (
                      <SelectItem key={label} value={String(index + 1)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Select value={String(year)} onValueChange={(value) => setYear(Number(value ?? year))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tenant-payment-amount">Amount collected</Label>
                <Input
                  id="tenant-payment-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tenant-payment-paid-at">Collected on</Label>
                <Input
                  id="tenant-payment-paid-at"
                  type="date"
                  value={paidAt}
                  onChange={(event) => setPaidAt(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Payment method</Label>
                <Select value={method} onValueChange={(value) => setMethod(value ?? "cash")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tenant-payment-notes">Notes</Label>
                <Input
                  id="tenant-payment-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Check number, memo"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Record payment"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
