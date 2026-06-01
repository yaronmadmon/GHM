"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleMinus, CirclePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/utils";

type LedgerAdjustmentMode = "charge" | "credit";

type AdjustmentOption = {
  value: string;
  label: string;
  helper: string;
};

const CHARGE_OPTIONS: AdjustmentOption[] = [
  { value: "late_fee", label: "Late fee", helper: "Rent paid after the lease grace period." },
  { value: "utility_reimbursement", label: "Utility reimbursement", helper: "Water, electric, gas, or other tenant-billed utilities." },
  { value: "repair_chargeback", label: "Repair chargeback", helper: "Tenant-responsible repairs or damage." },
  { value: "nsf_fee", label: "NSF fee", helper: "Returned check or failed payment fee." },
  { value: "returned_payment_fee", label: "Returned payment fee", helper: "Fee tied to a returned payment." },
  { value: "legal_fee", label: "Legal fee", helper: "Attorney, notice, or legal administration charge." },
  { value: "court_fee", label: "Court fee", helper: "Court filing or marshal-related cost." },
  { value: "attorney_fee", label: "Attorney fee", helper: "Attorney fee charged to tenant ledger." },
  { value: "security_deposit_deduction", label: "Deposit deduction", helper: "Move-out or deposit-related tenant charge." },
  { value: "other", label: "Other charge", helper: "Any other tenant balance increase." },
];

const CREDIT_OPTIONS: AdjustmentOption[] = [
  { value: "rent_credit", label: "Rent credit", helper: "Credit toward open rent or tenant balance." },
  { value: "payment_correction", label: "Payment correction", helper: "Fix an overcharge or duplicate balance item." },
  { value: "concession", label: "Concession", helper: "Approved rent concession, abatement, or goodwill credit." },
  { value: "maintenance_credit", label: "Maintenance credit", helper: "Credit issued because of a repair or service issue." },
  { value: "deposit_credit", label: "Deposit credit", helper: "Credit related to deposit handling." },
  { value: "other_credit", label: "Other credit", helper: "Any other tenant balance reduction." },
];

type TenantChargeButtonProps = {
  leaseId: string;
  tenantName: string;
  mode?: LedgerAdjustmentMode;
  currentBalance?: number;
  buttonLabel?: string;
  className?: string;
  size?: "xs" | "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
};

function todayInputValue() {
  return new Date().toISOString().split("T")[0];
}

function defaultAdjustmentType(mode: LedgerAdjustmentMode) {
  return mode === "credit" ? "rent_credit" : "other";
}

function toIsoDate(dateValue: string) {
  return new Date(`${dateValue}T12:00:00`).toISOString();
}

export function TenantChargeButton({
  leaseId,
  tenantName,
  mode = "charge",
  currentBalance,
  buttonLabel,
  className,
  size = "sm",
  variant = "outline",
}: TenantChargeButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState(defaultAdjustmentType(mode));
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const isCredit = mode === "credit";
  const options = isCredit ? CREDIT_OPTIONS : CHARGE_OPTIONS;
  const selectedOption = options.find((option) => option.value === adjustmentType) ?? options[0];
  const parsedAmount = Number(amount);
  const hasAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const projectedBalance =
    typeof currentBalance === "number" && hasAmount
      ? currentBalance + (isCredit ? -parsedAmount : parsedAmount)
      : null;
  const title = isCredit ? "Give credit" : "Create charge";
  const defaultLabel = isCredit ? "Credit" : "Charge";
  const Icon = isCredit ? CircleMinus : CirclePlus;
  const fieldIdBase = `${mode}-${leaseId}`;

  function resetForm() {
    setAdjustmentType(defaultAdjustmentType(mode));
    setAmount("");
    setDate(todayInputValue());
    setDescription("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasAmount) {
      toast.error("Amount must be greater than zero");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/tenant-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaseId,
          chargeType: adjustmentType,
          amount: parsedAmount,
          date: toIsoDate(date),
          description: description.trim() || selectedOption.label,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error(typeof data?.error === "string" ? data.error : `Failed to ${isCredit ? "apply credit" : "create charge"}`);
        return;
      }

      toast.success(isCredit ? "Credit applied to tenant ledger" : "Charge added to tenant ledger");
      setOpen(false);
      resetForm();
      router.refresh();
    } catch {
      toast.error(`Failed to ${isCredit ? "apply credit" : "create charge"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size={size} variant={variant} className={cn("gap-1.5", className)} onClick={() => setOpen(true)}>
        <Icon className="h-4 w-4" />
        {buttonLabel ?? defaultLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {isCredit ? "Credits reduce the tenant balance." : "Charges increase the tenant balance."} This posts directly to {tenantName}'s ledger.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>{isCredit ? "Credit reason" : "Charge type"}</Label>
              <Select value={adjustmentType} onValueChange={(value) => setAdjustmentType(value ?? defaultAdjustmentType(mode))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{selectedOption.helper}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${fieldIdBase}-amount`}>Amount</Label>
                <Input
                  id={`${fieldIdBase}-amount`}
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${fieldIdBase}-date`}>Post date</Label>
                <Input
                  id={`${fieldIdBase}-date`}
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${fieldIdBase}-description`}>Memo</Label>
              <Input
                id={`${fieldIdBase}-description`}
                placeholder={isCredit ? "e.g. Approved rent concession" : "e.g. May water bill chargeback"}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            {typeof currentBalance === "number" && (
              <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/35 p-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Current balance</p>
                  <p className="mt-1 font-mono font-semibold">{formatCurrency(currentBalance)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">After posting</p>
                  <p className="mt-1 font-mono font-semibold">{projectedBalance === null ? "--" : formatCurrency(projectedBalance)}</p>
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : isCredit ? "Apply credit" : "Create charge"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
