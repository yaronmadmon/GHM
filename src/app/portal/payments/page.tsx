"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, DollarSign } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const PAYMENT_STYLES: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  partial: "bg-blue-100 text-blue-700 border-blue-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  pending: "bg-muted text-muted-foreground",
};

export default function PortalPaymentsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/portal/payments")
      .then((r) => {
        if (r.status === 401) { router.push("/portal/login"); return null; }
        return r.json();
      })
      .then((d) => d && setData(d))
      .catch(() => router.push("/portal/login"));
  }, [router]);

  if (!data) return <div className="p-6 text-muted-foreground text-sm">Loading...</div>;

  const payments = Array.isArray(data) ? data : [];

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/portal">
            <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>
          </Link>
          <h1 className="font-semibold">Payment History</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />All Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payment records found.</p>
            ) : (
              <div className="space-y-1">
                {payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(p.dueDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </p>
                      <p className="text-xs text-muted-foreground">Due {formatDate(new Date(p.dueDate))}</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <p className="text-sm font-mono">{formatCurrency(Number(p.amountPaid))}</p>
                        <p className="text-xs text-muted-foreground">of {formatCurrency(Number(p.amountDue))}</p>
                      </div>
                      <Badge className={`border text-xs ${PAYMENT_STYLES[p.status] ?? ""}`}>{p.status}</Badge>
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
