"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Home, DollarSign, Wrench, FileText, LogOut, Calendar } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const PAYMENT_STYLES: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  partial: "bg-blue-100 text-blue-700 border-blue-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  pending: "bg-muted text-muted-foreground",
};

export default function PortalDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/portal/me")
      .then((r) => {
        if (r.status === 401) { router.push("/portal/login"); return null; }
        return r.json();
      })
      .then((d) => d && setData(d))
      .catch(() => router.push("/portal/login"));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/portal/logout", { method: "POST" });
    router.push("/portal/login");
  }

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
      Loading your portal...
    </div>
  );

  const { tenant, lease } = data;

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Nav */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">{tenant.firstName} {tenant.lastName}</p>
            {lease && <p className="text-xs text-muted-foreground">{lease.unit.property.name} · Unit {lease.unit.unitNumber}</p>}
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {!lease ? (
          <Card><CardContent className="pt-6 text-center text-muted-foreground text-sm">No active lease on file.</CardContent></Card>
        ) : (
          <>
            {/* Lease overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Home className="h-4 w-4" />Your Home
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="font-medium">{lease.unit.property.addressLine1}</p>
                  <p className="text-muted-foreground text-xs">{lease.unit.property.city}, {lease.unit.property.state}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Unit</p>
                  <p className="font-medium">{lease.unit.unitNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Rent</p>
                  <p className="font-mono font-medium">{formatCurrency(lease.rentAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lease End</p>
                  <p>{lease.endDate ? formatDate(new Date(lease.endDate)) : "Month-to-month"}</p>
                </div>
              </CardContent>
            </Card>

            {/* Next payment */}
            {lease.nextPayment && (
              <Card className={lease.nextPayment.status === "overdue" ? "border-red-200 bg-red-50/30" : ""}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    {lease.nextPayment.status === "overdue" ? "Overdue Payment" : "Next Payment"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-lg font-semibold">
                      {formatCurrency(Number(lease.nextPayment.amountDue) - Number(lease.nextPayment.amountPaid))}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Calendar className="h-3 w-3" />Due {formatDate(new Date(lease.nextPayment.dueDate))}
                    </p>
                  </div>
                  <Badge className={`border text-xs ${PAYMENT_STYLES[lease.nextPayment.status] ?? ""}`}>
                    {lease.nextPayment.status}
                  </Badge>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Quick nav */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/portal/payments">
            <Card className="hover:bg-muted/40 transition-colors cursor-pointer h-full">
              <CardContent className="pt-5 pb-4 text-center">
                <DollarSign className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium text-sm">Payment History</p>
                <p className="text-xs text-muted-foreground mt-0.5">View all rent payments</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/portal/maintenance">
            <Card className="hover:bg-muted/40 transition-colors cursor-pointer h-full">
              <CardContent className="pt-5 pb-4 text-center">
                <Wrench className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium text-sm">Maintenance</p>
                <p className="text-xs text-muted-foreground mt-0.5">Submit or track requests</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Documents */}
        {lease?.documents?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {lease.documents.map((doc: any) => (
                <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted text-sm transition-colors">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  {doc.name}
                </a>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
