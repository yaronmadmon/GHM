"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  User, Briefcase, Home, CheckCircle, XCircle, ArrowLeft,
  Send, FileText, ShieldCheck, ClipboardCheck,
} from "lucide-react";
import Link from "next/link";
import { DocumentsSection } from "@/components/applications/DocumentsSection";
import { ScreeningSection } from "@/components/applications/ScreeningSection";
import { WorkflowVerificationPanel } from "@/components/applications/WorkflowVerificationPanel";
import { formatCurrency } from "@/lib/utils";

interface AppDoc { id: string; docType: string; }
interface Reference { id: string; }

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
  petsDescription: string | null;
  hasVehicles: boolean;
  vehiclesDescription: string | null;
  backgroundCheckStatus: string | null;
  backgroundCheckNotes: string | null;
  backgroundCheckDate: string | null;
  convertedLeaseId: string | null;
  property: { name: string } | null;
  unit: { unitNumber: string } | null;
  createdAt: string;
  reviewedAt: string | null;
  documents: AppDoc[];
  references: Reference[];
}

const STATUS_STEPS = [
  { value: "pending", label: "Submitted" },
  { value: "documents_requested", label: "Docs Requested" },
  { value: "under_review", label: "Under Review" },
  { value: "screening", label: "Screening" },
  { value: "approved", label: "Approved" },
];

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  documents_requested: "bg-blue-100 text-blue-800 border-blue-200",
  under_review: "bg-purple-100 text-purple-800 border-purple-200",
  screening: "bg-indigo-100 text-indigo-800 border-indigo-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  denied: "bg-red-100 text-red-800 border-red-200",
};

const NEXT_STATUS: Record<string, { status: string; label: string }> = {
  pending: { status: "documents_requested", label: "Request Documents" },
  documents_requested: { status: "under_review", label: "Mark Under Review" },
  under_review: { status: "screening", label: "Start Screening" },
};

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<Application | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertForm, setConvertForm] = useState({ startDate: "", endDate: "", rentAmount: "", depositAmount: "" });
  const [converting, setConverting] = useState(false);
  const [denying, setDenying] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [sendingLease, setSendingLease] = useState(false);
  const [signUrl, setSignUrl] = useState("");
  const [guardErrors, setGuardErrors] = useState<string[]>([]);
  const [docs, setDocs] = useState<AppDoc[]>([]);
  const [screeningStatus, setScreeningStatus] = useState<string | null>(null);

  const loadApp = useCallback(() => {
    fetch(`/api/applications/${id}`).then((r) => r.json()).then((data) => {
      setApp(data);
      setDocs(data.documents ?? []);
      setScreeningStatus(data.backgroundCheckStatus ?? null);
    }).catch(() => {});
  }, [id]);

  useEffect(() => { loadApp(); }, [loadApp]);

  async function advanceStatus() {
    if (!app) return;
    const next = NEXT_STATUS[app.status];
    if (!next) return;
    setAdvancing(true);
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next.status }),
    });
    setAdvancing(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed"); return; }
    toast.success(`Status updated to: ${next.label}`);
    setApp((a) => a ? { ...a, status: next.status } : null);
  }

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
    setGuardErrors([]);
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
    if (!res.ok) {
      const d = await res.json();
      if (d.guards) { setGuardErrors(d.guards); toast.error("Requirements not met — see checklist"); }
      else toast.error(d.error ?? "Failed to convert");
      return;
    }
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
    setSignUrl(d.signUrl ?? "");
    toast.success("Lease sent to tenant for signing!");
  }

  if (!app) return <div className="p-6 text-muted-foreground">Loading...</div>;

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.value === app.status);
  const canAdvance = !!NEXT_STATUS[app.status];
  const isDenied = app.status === "denied";
  const isApproved = app.status === "approved";

  // Approval readiness check (mirror server guards)
  const hasEmail = !!app.email;
  const screeningOk = screeningStatus === "passed" || screeningStatus === "conditional";
  const hasDocs = docs.length > 0;
  const canApprove = hasEmail && screeningOk && hasDocs;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/applications"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold">{app.firstName} {app.lastName}</h1>
          <p className="text-sm text-muted-foreground">{app.property?.name}{app.unit ? ` · Unit ${app.unit.unitNumber}` : ""}</p>
        </div>
        <Badge className={`border shrink-0 capitalize ${STATUS_COLOR[app.status] ?? "bg-muted"}`}>{app.status.replace("_", " ")}</Badge>
      </div>

      {/* Workflow progress bar */}
      {!isDenied && (
        <div className="mb-5 p-3 bg-muted/30 rounded-xl border">
          <div className="flex items-center gap-1 md:gap-2">
            {STATUS_STEPS.map((step, i) => (
              <div key={step.value} className="flex items-center gap-1 md:gap-2 flex-1 min-w-0">
                <div className={`flex items-center gap-1 flex-1 min-w-0 ${i <= currentStepIndex ? "text-primary" : "text-muted-foreground"}`}>
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i < currentStepIndex ? "bg-emerald-500 text-white" : i === currentStepIndex ? "bg-primary text-white" : "bg-muted-foreground/20 text-muted-foreground"}`}>
                    {i < currentStepIndex ? "✓" : i + 1}
                  </div>
                  <span className="text-xs font-medium truncate hidden sm:block">{step.label}</span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 rounded shrink-0 ${i < currentStepIndex ? "bg-emerald-400" : "bg-muted-foreground/20"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action bar */}
      {!isDenied && !isApproved && (
        <div className="flex flex-wrap gap-2 mb-5">
          {canAdvance && (
            <Button onClick={advanceStatus} disabled={advancing} variant="outline" size="sm">
              {advancing ? "Updating..." : `→ ${NEXT_STATUS[app.status].label}`}
            </Button>
          )}
          {app.status === "screening" && (
            <Button
              onClick={() => { setGuardErrors([]); setConvertOpen(true); }}
              disabled={!canApprove}
              title={!canApprove ? "Requires: email, docs, and passed screening" : ""}
              className="gap-2"
              size="sm"
            >
              <CheckCircle className="h-4 w-4" />Approve & Convert
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDeny} disabled={denying} className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
            <XCircle className="h-4 w-4" />{denying ? "Denying..." : "Deny"}
          </Button>
        </div>
      )}

      {isApproved && app.convertedLeaseId && (
        <div className="flex gap-2 flex-wrap mb-5">
          <Button onClick={handleSendLease} disabled={sendingLease} size="sm" className="gap-2">
            <Send className="h-4 w-4" />{sendingLease ? "Sending..." : "Send Lease for Signature"}
          </Button>
          <Link href={`/leases/${app.convertedLeaseId}`}><Button variant="outline" size="sm">View Lease</Button></Link>
        </div>
      )}

      {signUrl && (
        <div className="mb-5 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
          <p className="font-medium text-blue-800 mb-1">Lease signing link (send to tenant):</p>
          <p className="text-blue-700 break-all font-mono text-xs">{signUrl}</p>
        </div>
      )}

      {/* Approval readiness (when in screening stage) */}
      {app.status === "screening" && !isApproved && (
        <div className="mb-5 p-3 rounded-lg border bg-muted/20">
          <p className="text-sm font-medium mb-2">Approval Requirements</p>
          <div className="space-y-1 text-sm">
            {[
              { ok: hasEmail, label: "Applicant has email address" },
              { ok: hasDocs, label: "At least one document on file" },
              { ok: screeningOk, label: "Screening passed or conditional" },
            ].map(({ ok, label }) => (
              <div key={label} className="flex items-center gap-2">
                {ok ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {guardErrors.length > 0 && (
        <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 space-y-1">
          {guardErrors.map((e) => <p key={e}>• {e}</p>)}
        </div>
      )}

      {/* Main content + verification panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Tabs defaultValue="profile">
            <TabsList className="w-full">
              <TabsTrigger value="profile" className="flex-1 gap-1.5"><User className="h-3.5 w-3.5" />Profile</TabsTrigger>
              <TabsTrigger value="documents" className="flex-1 gap-1.5"><FileText className="h-3.5 w-3.5" />Documents</TabsTrigger>
              <TabsTrigger value="screening" className="flex-1 gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Screening</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />Personal Info</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground text-xs">Email</p><p>{app.email ?? "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Phone</p><p>{app.phone ?? "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Date of Birth</p><p>{app.dateOfBirth ? new Date(app.dateOfBirth).toLocaleDateString() : "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Current Address</p><p>{app.currentAddress ?? "—"}</p></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Briefcase className="h-4 w-4" />Employment</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground text-xs">Employer</p><p>{app.employerName ?? "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Job Title</p><p>{app.jobTitle ?? "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Monthly Income</p><p>{app.monthlyIncome ? formatCurrency(Number(app.monthlyIncome)) : "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Employer Phone</p><p>{app.employerPhone ?? "—"}</p></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Home className="h-4 w-4" />Rental History</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground text-xs">Current Landlord</p><p>{app.currentLandlordName ?? "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Landlord Phone</p><p>{app.currentLandlordPhone ?? "—"}</p></div>
                  <div className="col-span-2"><p className="text-muted-foreground text-xs">Reason for Moving</p><p>{app.reasonForMoving ?? "—"}</p></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Pets & Vehicles</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground text-xs">Pets</p><p>{app.hasPets ? (app.petsDescription || "Yes") : "No"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Vehicles</p><p>{app.hasVehicles ? (app.vehiclesDescription || "Yes") : "No"}</p></div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Supporting Documents</CardTitle>
                  <p className="text-xs text-muted-foreground">Add links to documents shared via Google Drive, Dropbox, or any URL.</p>
                </CardHeader>
                <CardContent>
                  <DocumentsSection
                    applicationId={id}
                    onDocsChange={(updated) => {
                      setDocs(updated);
                      setApp((a) => a ? { ...a, documents: updated } : null);
                    }}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="screening" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Background Screening</CardTitle>
                  <p className="text-xs text-muted-foreground">Record background check results. Approval requires passed or conditional status.</p>
                </CardHeader>
                <CardContent>
                  <ScreeningSection
                    applicationId={id}
                    initialStatus={app.backgroundCheckStatus}
                    initialNotes={app.backgroundCheckNotes}
                    initialDate={app.backgroundCheckDate}
                    onChange={(s) => setScreeningStatus(s)}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Workflow Verification Panel */}
        <div>
          <Card className="sticky top-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />Workflow Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <WorkflowVerificationPanel app={{ ...app, documents: docs, references: app.references }} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Convert Dialog */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve & Create Lease</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Set lease terms. A portal invite will be emailed automatically.</p>
            {guardErrors.length > 0 && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 space-y-1">
                {guardErrors.map((e) => <p key={e}>• {e}</p>)}
              </div>
            )}
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
