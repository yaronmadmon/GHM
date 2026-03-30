"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Briefcase, Home, CheckCircle, XCircle, ArrowLeft, Send } from "lucide-react";
import Link from "next/link";

interface Application {
  id: string;
  status: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  currentAddress: string | null;
  employerName: string | null;
  jobTitle: string | null;
  monthlyIncome: number | null;
  employerPhone: string | null;
  currentLandlordName: string | null;
  currentLandlordPhone: string | null;
  reasonForMoving: string | null;
  hasPets: boolean;
  petDetails: string | null;
  hasVehicles: boolean;
  vehicleDetails: string | null;
  backgroundCheckStatus: string | null;
  backgroundCheckNotes: string | null;
  convertedLeaseId: string | null;
  property: { name: string } | null;
  unit: { unitNumber: string } | null;
  createdAt: string;
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [app, setApp] = useState<Application | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertForm, setConvertForm] = useState({ startDate: "", endDate: "", rentAmount: "", depositAmount: "" });
  const [converting, setConverting] = useState(false);
  const [denying, setDenying] = useState(false);
  const [sendingLease, setSendingLease] = useState(false);
  const [signUrl, setSignUrl] = useState("");

  useEffect(() => {
    fetch(`/api/applications/${id}`).then((r) => r.json()).then(setApp).catch(() => {});
  }, [id]);

  async function handleDeny() {
    setDenying(true);
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "denied" }),
    });
    setDenying(false);
    if (res.ok) { toast.success("Application denied"); setApp((a) => a ? { ...a, status: "denied" } : null); }
    else toast.error("Failed to update");
  }

  async function handleConvert() {
    if (!convertForm.startDate || !convertForm.rentAmount) { toast.error("Start date and rent are required"); return; }
    setConverting(true);
    const res = await fetch(`/api/applications/${id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: convertForm.startDate,
        endDate: convertForm.endDate || undefined,
        rentAmount: parseFloat(convertForm.rentAmount),
        depositAmount: parseFloat(convertForm.depositAmount || "0"),
      }),
    });
    setConverting(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed to convert"); return; }
    const data = await res.json();
    toast.success("Applicant converted to tenant! Portal invite sent.");
    setApp((a) => a ? { ...a, status: "approved", convertedLeaseId: data.lease.id } : null);
    setConvertOpen(false);
  }

  async function handleSendLease() {
    if (!app?.convertedLeaseId) return;
    setSendingLease(true);
    const res = await fetch(`/api/leases/${app.convertedLeaseId}/send-for-signing`, { method: "POST" });
    setSendingLease(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed to send"); return; }
    const d = await res.json();
    setSignUrl(d.signUrl);
    toast.success("Lease sent to tenant for signing!");
  }

  if (!app) return <div className="p-6 text-muted-foreground">Loading...</div>;

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-green-100 text-green-800",
    denied: "bg-red-100 text-red-800",
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/applications"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{app.firstName} {app.lastName}</h1>
          <p className="text-sm text-muted-foreground">{app.property?.name}{app.unit ? ` · Unit ${app.unit.unitNumber}` : ""}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${statusColor[app.status] ?? "bg-muted"}`}>{app.status}</span>
      </div>

      {/* Action buttons */}
      {app.status === "pending" && (
        <div className="flex gap-3">
          <Button onClick={() => setConvertOpen(true)} className="gap-2">
            <CheckCircle className="h-4 w-4" /> Approve & Convert to Tenant
          </Button>
          <Button variant="outline" onClick={handleDeny} disabled={denying} className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
            <XCircle className="h-4 w-4" /> Deny
          </Button>
        </div>
      )}

      {app.status === "approved" && app.convertedLeaseId && (
        <div className="flex gap-3 flex-wrap">
          <Button onClick={handleSendLease} disabled={sendingLease} className="gap-2">
            <Send className="h-4 w-4" /> {sendingLease ? "Sending..." : "Send Lease for Signature"}
          </Button>
          <Link href={`/leases`}><Button variant="outline">View Lease</Button></Link>
        </div>
      )}

      {signUrl && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
          <p className="font-medium text-blue-800 mb-1">Lease signing link:</p>
          <p className="text-blue-700 break-all">{signUrl}</p>
        </div>
      )}

      {/* Personal Info */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" /> Personal Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-muted-foreground">Email</p><p>{app.email ?? "—"}</p></div>
          <div><p className="text-muted-foreground">Phone</p><p>{app.phone ?? "—"}</p></div>
          <div><p className="text-muted-foreground">Date of Birth</p><p>{app.dateOfBirth ? new Date(app.dateOfBirth).toLocaleDateString() : "—"}</p></div>
          <div><p className="text-muted-foreground">Current Address</p><p>{app.currentAddress ?? "—"}</p></div>
        </CardContent>
      </Card>

      {/* Employment */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Briefcase className="h-4 w-4" /> Employment</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-muted-foreground">Employer</p><p>{app.employerName ?? "—"}</p></div>
          <div><p className="text-muted-foreground">Job Title</p><p>{app.jobTitle ?? "—"}</p></div>
          <div><p className="text-muted-foreground">Monthly Income</p><p>{app.monthlyIncome ? `$${app.monthlyIncome.toLocaleString()}` : "—"}</p></div>
          <div><p className="text-muted-foreground">Employer Phone</p><p>{app.employerPhone ?? "—"}</p></div>
        </CardContent>
      </Card>

      {/* Rental History */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Home className="h-4 w-4" /> Rental History</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-muted-foreground">Current Landlord</p><p>{app.currentLandlordName ?? "—"}</p></div>
          <div><p className="text-muted-foreground">Landlord Phone</p><p>{app.currentLandlordPhone ?? "—"}</p></div>
          <div className="col-span-2"><p className="text-muted-foreground">Reason for Moving</p><p>{app.reasonForMoving ?? "—"}</p></div>
        </CardContent>
      </Card>

      {/* Pets & Vehicles */}
      <Card>
        <CardHeader><CardTitle className="text-base">Pets & Vehicles</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-muted-foreground">Pets</p><p>{app.hasPets ? (app.petDetails || "Yes") : "No"}</p></div>
          <div><p className="text-muted-foreground">Vehicles</p><p>{app.hasVehicles ? (app.vehicleDetails || "Yes") : "No"}</p></div>
        </CardContent>
      </Card>

      {/* Convert Dialog */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve & Create Lease</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Set the lease terms to convert this applicant to a tenant. A portal invite will be emailed to them automatically.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date *</Label>
                <Input type="date" value={convertForm.startDate} onChange={(e) => setConvertForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date (blank = month-to-month)</Label>
                <Input type="date" value={convertForm.endDate} onChange={(e) => setConvertForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monthly Rent ($) *</Label>
                <Input type="number" step="0.01" value={convertForm.rentAmount} onChange={(e) => setConvertForm((f) => ({ ...f, rentAmount: e.target.value }))} placeholder="1500.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Security Deposit ($)</Label>
                <Input type="number" step="0.01" value={convertForm.depositAmount} onChange={(e) => setConvertForm((f) => ({ ...f, depositAmount: e.target.value }))} placeholder="1500.00" />
              </div>
            </div>
            <Button onClick={handleConvert} disabled={converting} className="w-full">
              {converting ? "Creating..." : "Approve & Create Tenant + Lease"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
