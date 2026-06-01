"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, FileText, Home, LogOut, MessageSquare, Wrench } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const PAYMENT_STYLES: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  partial: "bg-blue-500/10 text-blue-700 border-blue-200",
  overdue: "bg-red-500/10 text-red-700 border-red-200",
  pending: "bg-muted text-muted-foreground",
};

export default function PortalDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/portal/me")
      .then((response) => {
        if (response.status === 401) {
          router.push("/portal/login");
          return null;
        }
        return response.json();
      })
      .then((payload) => payload && setData(payload))
      .catch(() => router.push("/portal/login"));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/portal/logout", { method: "POST" });
    router.push("/portal/login");
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading your portal...
      </div>
    );
  }

  const { tenant, lease } = data;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/94 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <div className="min-w-0">
            <p className="font-heading text-2xl font-semibold leading-none">{tenant.firstName} {tenant.lastName}</p>
            {lease && <p className="mt-1 truncate text-xs text-muted-foreground">{lease.unit.property.name} - Unit {lease.unit.unitNumber}</p>}
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        {!lease ? (
          <div className="empty-state">
            <Home className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h1 className="font-heading text-3xl font-semibold">No active lease on file</h1>
            <p className="mt-2 text-sm text-muted-foreground">Contact your property manager if this looks incorrect.</p>
          </div>
        ) : (
          <>
            <section className="office-header">
              <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="page-kicker">Resident Portal</p>
                  <h1 className="page-title mt-2">Your Home</h1>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {lease.unit.property.addressLine1}, {lease.unit.property.city}, {lease.unit.property.state}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 md:w-[22rem]">
                  <div className="rounded-md border bg-background/55 p-3">
                    <p className="text-xs text-muted-foreground">Monthly rent</p>
                    <p className="mt-1 font-mono text-lg font-semibold">{formatCurrency(lease.rentAmount)}</p>
                  </div>
                  <div className="rounded-md border bg-background/55 p-3">
                    <p className="text-xs text-muted-foreground">Lease end</p>
                    <p className="mt-1 text-sm font-semibold">{lease.endDate ? formatDate(new Date(lease.endDate)) : "Month-to-month"}</p>
                  </div>
                </div>
              </div>
            </section>

            {lease.nextPayment && (
              <Card className={lease.nextPayment.status === "overdue" ? "border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/20" : ""}>
                <CardHeader className="border-b pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DollarSign className="h-4 w-4 text-primary" />
                    {lease.nextPayment.status === "overdue" ? "Overdue Payment" : "Next Payment"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-2xl font-semibold">
                      {formatCurrency(Number(lease.nextPayment.amountDue) - Number(lease.nextPayment.amountPaid))}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Due {formatDate(new Date(lease.nextPayment.dueDate))}
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link href="/portal/payments" className="block">
            <article className="rounded-lg border bg-card p-5 text-center shadow-sm transition-colors hover:border-primary/35 hover:bg-muted/30">
              <DollarSign className="mx-auto mb-3 h-6 w-6 text-primary" />
              <p className="font-semibold">Payments</p>
              <p className="mt-1 text-xs text-muted-foreground">View payment history</p>
            </article>
          </Link>
          <Link href="/portal/maintenance" className="block">
            <article className="rounded-lg border bg-card p-5 text-center shadow-sm transition-colors hover:border-primary/35 hover:bg-muted/30">
              <Wrench className="mx-auto mb-3 h-6 w-6 text-primary" />
              <p className="font-semibold">Maintenance</p>
              <p className="mt-1 text-xs text-muted-foreground">Submit or track requests</p>
            </article>
          </Link>
          <Link href="/portal/messages" className="block">
            <article className="rounded-lg border bg-card p-5 text-center shadow-sm transition-colors hover:border-primary/35 hover:bg-muted/30">
              <MessageSquare className="mx-auto mb-3 h-6 w-6 text-primary" />
              <p className="font-semibold">Messages</p>
              <p className="mt-1 text-xs text-muted-foreground">Contact the office</p>
            </article>
          </Link>
        </div>

        {lease?.documents?.length > 0 && (
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {lease.documents.map((doc: any) => (
                <a
                  key={doc.id}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-muted"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
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
