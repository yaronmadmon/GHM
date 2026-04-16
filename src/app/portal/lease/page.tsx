"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const SIGNING_STYLES: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  draft:         { label: "Not Sent",        icon: <Clock className="h-4 w-4" />,         cls: "bg-muted text-muted-foreground" },
  sent:          { label: "Awaiting Your Signature", icon: <AlertCircle className="h-4 w-4" />, cls: "bg-amber-100 text-amber-700 border-amber-200" },
  tenant_signed: { label: "Signed — Awaiting Landlord", icon: <Clock className="h-4 w-4" />,   cls: "bg-blue-100 text-blue-700 border-blue-200" },
  fully_signed:  { label: "Fully Signed",    icon: <CheckCircle2 className="h-4 w-4" />,   cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const PAYMENT_STYLES: Record<string, string> = {
  paid:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  partial: "bg-blue-100 text-blue-700 border-blue-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  pending: "bg-muted text-muted-foreground",
};

export default function PortalLeasePage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/portal/me")
      .then((r) => {
        if (r.status === 401) { router.push("/portal/login"); return null; }
        return r.json();
      })
      .then((d) => d && setData(d))
      .catch(() => router.push("/portal/login"));

    fetch("/api/portal/payments")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => Array.isArray(d) ? setPayments(d) : setPayments([]))
      .catch(() => {});
  }, [router]);

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
      Loading lease details...
    </div>
  );

  const { lease } = data;
  const signing = lease ? SIGNING_STYLES[lease.signingStatus] ?? SIGNING_STYLES.draft : null;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/portal">
            <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>
          </Link>
          <h1 className="font-semibold">My Lease</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {!lease ? (
          <Card><CardContent className="pt-6 text-center text-muted-foreground text-sm">No active lease on file.</CardContent></Card>
        ) : (
          <>
            {/* Lease Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Lease Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Property</p>
                  <p className="font-medium">{lease.unit.property.name}</p>
                  <p className="text-xs text-muted-foreground">{lease.unit.property.addressLine1}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Unit</p>
                  <p className="font-medium">Unit {lease.unit.unitNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="font-medium">{formatDate(new Date(lease.startDate))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">End Date</p>
                  <p className="font-medium">{lease.endDate ? formatDate(new Date(lease.endDate)) : "Month-to-month"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Rent</p>
                  <p className="font-mono font-medium">{formatCurrency(lease.rentAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Security Deposit</p>
                  <p className="font-mono font-medium">{formatCurrency(lease.depositAmount)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Lease Status</p>
                  <Badge variant="outline" className="capitalize">{lease.status}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Signing Status */}
            {signing && lease.signingStatus !== "draft" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Signing Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge className={`border gap-1.5 ${signing.cls}`}>
                    {signing.icon}{signing.label}
                  </Badge>
                  {lease.signingStatus === "sent" && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Your landlord has sent the lease for your signature. Check your email for the signing link.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Documents */}
            {lease.documents?.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {lease.documents.map((doc: any) => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded hover:bg-muted text-sm transition-colors"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{doc.name}</span>
                    </a>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Payment History */}
            {payments.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Payment History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {payments.slice(0, 12).map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{p.periodYear}/{String(p.periodMonth).padStart(2, "0")}</p>
                        <p className="text-xs text-muted-foreground">Due {formatDate(new Date(p.dueDate))}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-medium">{formatCurrency(Number(p.amountPaid))}</p>
                        <Badge className={`border text-xs ${PAYMENT_STYLES[p.status] ?? ""}`}>{p.status}</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
