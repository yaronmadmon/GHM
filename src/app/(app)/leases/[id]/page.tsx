"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, DollarSign, Users, Send, CheckCircle, Building2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { MoveInChecklist } from "@/components/leases/MoveInChecklist";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  expired: "bg-muted text-muted-foreground",
  terminated: "bg-red-500/10 text-red-600 border-red-200",
  pending: "bg-blue-500/10 text-blue-600 border-blue-200",
};

const PAYMENT_STATUS: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  partial: "bg-blue-500/10 text-blue-700 border-blue-200",
  overdue: "bg-red-500/10 text-red-700 border-red-200",
  pending: "bg-muted text-muted-foreground",
};

export default function LeaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lease, setLease] = useState<any>(null);
  const [sendingLease, setSendingLease] = useState(false);
  const [countersigning, setCountersigning] = useState(false);

  useEffect(() => {
    fetch(`/api/leases/${id}`).then((r) => r.json()).then(setLease).catch(() => {});
  }, [id]);

  async function handleSendForSigning() {
    setSendingLease(true);
    const res = await fetch(`/api/leases/${id}/send-for-signing`, { method: "POST" });
    setSendingLease(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed to send"); return; }
    toast.success("Lease sent to tenant for signing!");
    const d = await res.json();
    setLease((l: any) => ({ ...l, signingStatus: "sent", signingToken: d.signingToken }));
  }

  async function handleCountersign() {
    setCountersigning(true);
    const res = await fetch(`/api/leases/${id}/countersign`, { method: "POST" });
    setCountersigning(false);
    if (!res.ok) { toast.error("Failed to countersign"); return; }
    toast.success("Lease fully signed!");
    setLease((l: any) => ({ ...l, signingStatus: "fully_signed" }));
  }

  if (!lease) return <div className="p-6 text-muted-foreground">Loading...</div>;

  const primaryTenant = lease.tenants?.find((lt: any) => lt.isPrimary)?.tenant ?? lease.tenants?.[0]?.tenant;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/leases">
          <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold truncate">
            {primaryTenant ? `${primaryTenant.firstName} ${primaryTenant.lastName}` : "Lease"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lease.unit?.property?.name} · Unit {lease.unit?.unitNumber}
          </p>
        </div>
        <Badge className={`border shrink-0 ${STATUS_STYLES[lease.status] ?? ""}`}>{lease.status}</Badge>
      </div>

      {/* Signing actions */}
      {lease.signingStatus === "draft" && (
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleSendForSigning} disabled={sendingLease} className="gap-2">
            <Send className="h-4 w-4" />{sendingLease ? "Sending..." : "Send for Tenant Signature"}
          </Button>
        </div>
      )}
      {lease.signingStatus === "sent" && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
          Sent to tenant for signing. Awaiting their signature.
        </div>
      )}
      {lease.signingStatus === "tenant_signed" && (
        <div className="flex gap-2 flex-wrap items-center">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex-1">
            Tenant has signed. Your countersignature is needed.
          </div>
          <Button onClick={handleCountersign} disabled={countersigning} className="gap-2">
            <CheckCircle className="h-4 w-4" />{countersigning ? "Signing..." : "Countersign"}
          </Button>
        </div>
      )}
      {lease.signingStatus === "fully_signed" && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 font-medium">
          ✓ Fully signed by both parties
          {lease.tenantSignedAt && ` — tenant signed ${formatDate(lease.tenantSignedAt)}`}
        </div>
      )}

      {/* Move-in checklist */}
      {lease.signingStatus === "fully_signed" && !lease.moveInCompleted && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />Move-in Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MoveInChecklist
              leaseId={id}
              onComplete={() => setLease((l: any) => ({ ...l, moveInCompleted: true, moveInCompletedAt: new Date().toISOString() }))}
            />
          </CardContent>
        </Card>
      )}
      {lease.moveInCompleted && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 font-medium">
          ✓ Move-in confirmed{lease.moveInCompletedAt ? ` — ${formatDate(lease.moveInCompletedAt)}` : ""}
        </div>
      )}

      {/* Lease details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />Lease Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-muted-foreground text-xs">Property</p><p className="font-medium">{lease.unit?.property?.name}</p></div>
          <div><p className="text-muted-foreground text-xs">Unit</p><p className="font-medium">{lease.unit?.unitNumber}</p></div>
          <div><p className="text-muted-foreground text-xs">Start Date</p><p>{formatDate(lease.startDate)}</p></div>
          <div><p className="text-muted-foreground text-xs">End Date</p><p>{lease.endDate ? formatDate(lease.endDate) : "Month-to-month"}</p></div>
          <div><p className="text-muted-foreground text-xs">Monthly Rent</p><p className="font-mono font-medium">{formatCurrency(Number(lease.rentAmount))}</p></div>
          <div><p className="text-muted-foreground text-xs">Security Deposit</p><p className="font-mono">{formatCurrency(Number(lease.depositAmount ?? 0))}</p></div>
          <div><p className="text-muted-foreground text-xs">Deposit Paid</p><p>{lease.depositPaid ? "Yes" : "No"}</p></div>
          <div><p className="text-muted-foreground text-xs">Lease Type</p><p className="capitalize">{lease.leaseType?.replace("_", " ")}</p></div>
        </CardContent>
      </Card>

      {/* Tenants */}
      {lease.tenants?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />Tenants
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lease.tenants.map((lt: any) => (
              <Link key={lt.tenant.id} href={`/tenants/${lt.tenant.id}`}>
                <div className="flex items-center justify-between p-2 rounded hover:bg-muted transition-colors">
                  <div>
                    <p className="font-medium text-sm">{lt.tenant.firstName} {lt.tenant.lastName}</p>
                    {lt.tenant.email && <p className="text-xs text-muted-foreground">{lt.tenant.email}</p>}
                  </div>
                  {lt.isPrimary && <Badge variant="outline" className="text-xs">Primary</Badge>}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Payment history */}
      {lease.rentPayments?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />Payment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {lease.rentPayments.slice(0, 12).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                  <span className="text-muted-foreground">{new Date(p.dueDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{formatCurrency(Number(p.amountPaid))} / {formatCurrency(Number(p.amountDue))}</span>
                    <Badge className={`text-xs border ${PAYMENT_STATUS[p.status] ?? ""}`}>{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
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
              <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded hover:bg-muted text-sm transition-colors">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {doc.name}
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {lease.notes && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{lease.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
