"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const INCOME_CATEGORIES = ["rent", "late_fee", "deposit", "other"];
const EXPENSE_CATEGORIES = ["repair", "insurance", "tax", "utility", "management", "other"];

interface Property { id: string; name: string }

export default function NewTransactionPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [form, setForm] = useState({
    type: "income",
    category: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
    propertyId: "",
    paymentMethod: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/properties").then((r) => r.json()).then(setProperties).catch(() => {});
  }, []);

  const categories = form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function setField(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category || !form.amount || !form.date) {
      toast.error("Category, amount, and date are required");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.type,
        category: form.category,
        amount: parseFloat(form.amount),
        date: form.date,
        description: form.description || undefined,
        propertyId: form.propertyId || undefined,
        paymentMethod: form.paymentMethod || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error ?? "Failed to save transaction");
      return;
    }
    toast.success("Transaction recorded");
    router.push("/financials");
  }

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Add Transaction</h1>
      <Card>
        <CardHeader><CardTitle>Transaction Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type */}
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v ?? "income", category: "" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={(v) => setField("category", v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ($) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setField("amount", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder="e.g. January rent — Unit 4B"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
              />
            </div>

            {/* Property */}
            <div className="space-y-1.5">
              <Label>Property (optional)</Label>
              <Select value={form.propertyId} onValueChange={(v) => setField("propertyId", v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label>Payment Method (optional)</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setField("paymentMethod", v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="venmo">Venmo</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save Transaction"}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
