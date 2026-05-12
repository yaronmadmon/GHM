"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, DollarSign, CreditCard, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

const PAYMENT_STYLES: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  partial: "bg-blue-100 text-blue-700 border-blue-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  pending: "bg-muted text-muted-foreground",
};

function calcFee(amountDue: number) {
  return Math.round(amountDue * 0.029 * 100 + 30) / 100;
}

function PortalPaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payments, setPayments] = useState<any[]>([]);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("paid") === "true") {
      toast.success("Payment received! Your balance will update shortly.");
    }
    fetch("/api/portal/payments")
      .then((r) => {
        if (r.status === 401) { router.push("/portal/login"); return null; }
        return r.json();
      })
      .then((d) => d && setPayments(Array.isArray(d) ? d : []))
      .catch(() => router.push("/portal/login"));
  }, [router, searchParams]);

  async function payNow(rentPaymentId: string) {
    setPaying(rentPaymentId);
    try {
      const res = await fetch("/api/portal/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rentPaymentId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Payment unavailable"); return; }
      window.location.href = data.url;
    } catch {
      toast.error("Something went wrong");
    } finally {
      setPaying(null);
    }
  }

  const unpaid = payments.filter((p) => p.status !== "paid");
  const paid = payments.filter((p) => p.status === "paid");

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/portal">
            <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>
          </Link>
          <h1 className="font-semibold">Payments</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Unpaid */}
        {unpaid.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-amber-500" />Outstanding Payments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {unpaid.map((p: any) => {
                const fee = calcFee(Number(p.amountDue));
                const total = Number(p.amountDue) + fee;
                return (
                  <div key={p.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(p.dueDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </p>
                        <p className="text-xs text-muted-foreground">Due {formatDate(new Date(p.dueDate))}</p>
                      </div>
                      <Badge className={`border text-xs ${PAYMENT_STYLES[p.status] ?? ""}`}>{p.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-2">
                      <div className="flex justify-between">
                        <span>Rent</span><span className="font-mono">{formatCurrency(Number(p.amountDue))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Processing fee (2.9% + $0.30)</span><span className="font-mono">{formatCurrency(fee)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-foreground pt-1">
                        <span>Total charged</span><span className="font-mono">{formatCurrency(total)}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => payNow(p.id)}
                      disabled={paying === p.id}
                    >
                      {paying === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      {paying === p.id ? "Redirecting..." : `Pay ${formatCurrency(total)}`}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Paid history */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />Payment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paid.length === 0 && unpaid.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payment records yet.</p>
            ) : paid.length === 0 ? (
              <p className="text-sm text-muted-foreground">No paid payments yet.</p>
            ) : (
              <div className="space-y-1">
                {paid.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(p.dueDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Paid {p.paidAt ? formatDate(new Date(p.paidAt)) : "—"}
                        {p.paymentMethod && ` · ${p.paymentMethod}`}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="text-sm font-mono">{formatCurrency(Number(p.amountPaid))}</span>
                      <Badge className="border text-xs bg-emerald-100 text-emerald-700 border-emerald-200">paid</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function PortalPaymentsPage() {
  return (
    <Suspense fallback={null}>
      <PortalPaymentsContent />
    </Suspense>
  );
}
