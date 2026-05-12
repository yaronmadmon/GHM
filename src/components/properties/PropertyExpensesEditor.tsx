"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Sparkles, Info } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Expenses {
  propertyTaxMonthly: number | null;
  waterSewerMonthly: number | null;
  electricityMonthly: number | null;
  gasMonthly: number | null;
  insuranceMonthly: number | null;
  mortgageMonthly: number | null;
  hoaMonthly: number | null;
  otherMonthly: number | null;
  aiEstimatedAt?: string | null;
  lastEditedAt?: string | null;
}

interface Props {
  propertyId: string;
  initialExpenses: Expenses | null;
}

const ROWS: { key: keyof Omit<Expenses, "aiEstimatedAt" | "lastEditedAt">; label: string }[] = [
  { key: "propertyTaxMonthly", label: "Property Tax" },
  { key: "waterSewerMonthly", label: "Water / Sewer" },
  { key: "electricityMonthly", label: "Electricity" },
  { key: "gasMonthly", label: "Gas / Heating" },
  { key: "insuranceMonthly", label: "Insurance" },
  { key: "mortgageMonthly", label: "Mortgage" },
  { key: "hoaMonthly", label: "HOA" },
  { key: "otherMonthly", label: "Other" },
];

export function PropertyExpensesEditor({ propertyId, initialExpenses }: Props) {
  const [expenses, setExpenses] = useState<Expenses>(
    initialExpenses ?? {
      propertyTaxMonthly: null, waterSewerMonthly: null, electricityMonthly: null,
      gasMonthly: null, insuranceMonthly: null, mortgageMonthly: null,
      hoaMonthly: null, otherMonthly: null,
    }
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const wasAiEstimated = !!initialExpenses?.aiEstimatedAt;
  const wasEdited = !!expenses.lastEditedAt;

  const totalMonthly = ROWS.reduce((sum, r) => sum + (expenses[r.key] ?? 0), 0);

  function startEdit(key: string, current: number | null) {
    setEditing(key);
    setDraftValues((prev) => ({ ...prev, [key]: current !== null ? String(current) : "" }));
  }

  async function saveField(key: string) {
    const raw = draftValues[key] ?? "";
    const value = raw === "" ? null : parseFloat(raw);
    if (value !== null && isNaN(value)) {
      toast.error("Enter a valid number");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}/expenses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error("Save failed");
      const updated = await res.json();
      setExpenses((prev) => ({ ...prev, [key]: updated[key], lastEditedAt: updated.lastEditedAt }));
      setEditing(null);
    } catch {
      toast.error("Could not save — try again");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, key: string) {
    if (e.key === "Enter") saveField(key);
    if (e.key === "Escape") setEditing(null);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Monthly Operating Expenses
          </CardTitle>
          <div className="flex items-center gap-2">
            {wasAiEstimated && (
              <Badge variant="outline" className="text-xs gap-1 text-primary border-primary/30">
                <Sparkles className="h-3 w-3" />AI estimated
              </Badge>
            )}
            {wasEdited && (
              <Badge variant="outline" className="text-xs text-muted-foreground">Edited</Badge>
            )}
          </div>
        </div>
        {!wasAiEstimated && !wasEdited && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Info className="h-3 w-3 shrink-0" />
            Run the Financial Advisor to auto-estimate expenses, or click any row to enter manually.
          </p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {ROWS.map(({ key, label }) => {
            const value = expenses[key];
            const isEditing = editing === key;
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center justify-between px-6 py-2.5 text-sm",
                  !isEditing && "hover:bg-muted/30 cursor-pointer transition-colors"
                )}
                onClick={() => !isEditing && startEdit(key, value)}
              >
                <span className="text-muted-foreground">{label}</span>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">$/mo</span>
                    <input
                      autoFocus
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-28 rounded border bg-background px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                      value={draftValues[key] ?? ""}
                      onChange={(e) => setDraftValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      onBlur={() => saveField(key)}
                      onKeyDown={(e) => handleKeyDown(e, key)}
                      disabled={saving}
                    />
                  </div>
                ) : (
                  <span className={cn("font-mono", value === null ? "text-muted-foreground/50" : "font-medium")}>
                    {value !== null ? `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {totalMonthly > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/20 text-sm font-semibold">
            <span>Total monthly</span>
            <span className="font-mono text-destructive">
              ${totalMonthly.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
