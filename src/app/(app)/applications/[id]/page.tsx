"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  CheckCircle,
  ClipboardCheck,
  DollarSign,
  FileSignature,
  FileText,
  Home,
  KeyRound,
  Send,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { DocumentsSection } from "@/components/applications/DocumentsSection";
import { ScreeningSection } from "@/components/applications/ScreeningSection";
import { WorkflowVerificationPanel } from "@/components/applications/WorkflowVerificationPanel";
import { APPLICATION_DOCUMENT_LABELS, applicationRequirements } from "@/lib/application-workflow";
import { formatCurrency } from "@/lib/utils";

interface AppDoc {
  id: string;
  name?: string;
  url?: string;
  docType: string;
  createdAt?: string;
}

interface Reference {
  id: string;
  type: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
}

interface Occupant {
  name?: string;
  relationship?: string;
  dateOfBirth?: string;
}

interface Application {
  id: string;
  status: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  currentAddress: string | null;
  employerName: string | null;
  employerPhone: string | null;
  jobTitle: string | null;
  employmentStartDate: string | null;
  monthlyIncome: number | string | null;
  selfEmployed: boolean;
  additionalIncomeSource: string | null;
  additionalIncomeMonthly: number | string | null;
  currentLandlordName: string | null;
  currentLandlordPhone: string | null;
  currentAddressStartDate: string | null;
  previousAddress: string | null;
  previousLandlordName: string | null;
  previousLandlordPhone: string | null;
  reasonForMoving: string | null;
  everEvicted: boolean | null;
  evictionExplanation: string | null;
  hasCriminalHistory: boolean | null;
  criminalHistoryExplanation: string | null;
  hasBankruptcy: boolean | null;
  bankruptcyExplanation: string | null;
  hasPets: boolean;
  petsDescription: string | null;
  hasVehicles: boolean;
  vehiclesDescription: string | null;
  desiredMoveInDate: string | null;
  intendedLeaseTerm: string | null;
  numberOfOccupants: number | null;
  additionalOccupants: unknown;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  additionalNotes: string | null;
  backgroundCheckStatus: string | null;
  backgroundCheckNotes: string | null;
  backgroundCheckDate: string | null;
  decisionNotes: string | null;
  convertedTenantId: string | null;
  convertedLeaseId: string | null;
  convertedTenant: { id: string; firstName: string; lastName: string; email: string | null } | null;
  convertedLease: {
    id: string;
    signingStatus: string;
    signingToken: string | null;
    tenantSignedAt: string | null;
    landlordSignedAt: string | null;
    moveInCompleted: boolean;
    moveInCompletedAt: string | null;
  } | null;
  property: { id: string; name: string; address?: string | null } | null;
  unit: { unitNumber: string } | null;
  createdAt: string;
  signedAt: string | null;
  reviewedAt: string | null;
  documents: AppDoc[];
  references: Reference[];
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  documents_requested: "bg-blue-100 text-blue-800 border-blue-200",
  under_review: "bg-purple-100 text-purple-800 border-purple-200",
  screening: "bg-indigo-100 text-indigo-800 border-indigo-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  denied: "bg-red-100 text-red-800 border-red-200",
};

const SCREENING_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  passed: "Passed",
  conditional: "Conditional",
  failed: "Failed",
};

const DOCUMENT_REQUEST_OPTIONS = [
  { value: "government_id", label: APPLICATION_DOCUMENT_LABELS.government_id, helper: "Photo ID, driver's license, state ID, or passport" },
  { value: "pay_stub", label: APPLICATION_DOCUMENT_LABELS.pay_stub, helper: "Pay stubs, offer letter, benefits statement, or employer letter" },
  { value: "bank_statement", label: APPLICATION_DOCUMENT_LABELS.bank_statement, helper: "Recent bank statement or the last 2-3 months" },
  { value: "tax_return", label: APPLICATION_DOCUMENT_LABELS.tax_return, helper: "Useful for self-employed applicants" },
  { value: "previous_lease", label: APPLICATION_DOCUMENT_LABELS.previous_lease, helper: "Previous lease or rental verification document" },
  { value: "other", label: APPLICATION_DOCUMENT_LABELS.other, helper: "Use the message to describe exactly what is needed" },
];

function moneyValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shortDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString();
}

function dateInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function yesNo(value: boolean | null | undefined) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "--";
}

function parseOccupants(value: unknown): Occupant[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Occupant => !!item && typeof item === "object");
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.95rem] leading-snug text-muted-foreground">{label}</p>
      <p className="truncate text-[1.05rem] font-semibold leading-7">{value === null || value === undefined || value === "" ? "--" : value}</p>
    </div>
  );
}

function LongField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[0.95rem] leading-snug text-muted-foreground">{label}</p>
      <p className="text-[1.05rem] leading-7">{value || "--"}</p>
    </div>
  );
}

function getAdvisorRecommendation({
  screeningStatus,
  incomeRatio,
  hasDocs,
  hasEmail,
}: {
  screeningStatus: string | null;
  incomeRatio: number | null;
  hasDocs: boolean;
  hasEmail: boolean;
}) {
  if (screeningStatus === "failed") {
    return {
      label: "Not recommended",
      tone: "text-red-700 bg-red-50 border-red-200",
      detail: "Screening is failed. Deny or resolve the issue before moving forward.",
    };
  }
  if (screeningStatus === "passed" && hasDocs && hasEmail && incomeRatio !== null && incomeRatio >= 3) {
    return {
      label: "Recommended",
      tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
      detail: "The file has required basics, screening passed, and income is at least 3 times rent.",
    };
  }
  if ((screeningStatus === "passed" || screeningStatus === "conditional") && hasDocs && hasEmail) {
    return {
      label: "Conditional approval",
      tone: "text-amber-700 bg-amber-50 border-amber-200",
      detail: "The applicant can be approved, but review the notes, rent fit, and documents carefully.",
    };
  }
  return {
    label: "Needs review",
    tone: "text-blue-700 bg-blue-50 border-blue-200",
    detail: "Complete documents, screening, and lease terms before approving.",
  };
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<Application | null>(null);
  const [docs, setDocs] = useState<AppDoc[]>([]);
  const [convertOpen, setConvertOpen] = useState(false);
  const [screeningOpen, setScreeningOpen] = useState(false);
  const [requestDocsOpen, setRequestDocsOpen] = useState(false);
  const [convertForm, setConvertForm] = useState({ startDate: "", endDate: "", rentAmount: "", depositAmount: "" });
  const [decisionNotes, setDecisionNotes] = useState("");
  const [documentRequestTypes, setDocumentRequestTypes] = useState<string[]>([]);
  const [documentRequestMessage, setDocumentRequestMessage] = useState("");
  const [sendLeaseAfterApproval, setSendLeaseAfterApproval] = useState(true);
  const [converting, setConverting] = useState(false);
  const [denying, setDenying] = useState(false);
  const [sendingDocumentRequest, setSendingDocumentRequest] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [sendingLease, setSendingLease] = useState(false);
  const [countersigning, setCountersigning] = useState(false);
  const [signUrl, setSignUrl] = useState("");
  const [guardErrors, setGuardErrors] = useState<string[]>([]);

  const loadApp = useCallback(async () => {
    try {
      const res = await fetch(`/api/applications/${id}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setApp(data);
      setDocs(data.documents ?? []);
      setDecisionNotes(data.decisionNotes ?? "");
      setConvertForm((current) => ({
        ...current,
        startDate: current.startDate || dateInput(data.desiredMoveInDate),
      }));
      if (data.convertedLease?.signingToken) {
        setSignUrl(`${window.location.origin}/lease-sign/${data.convertedLease.signingToken}`);
      }
    } catch {
      toast.error("Could not load application");
    }
  }, [id]);

  useEffect(() => {
    loadApp();
  }, [loadApp]);

  const occupants = useMemo(() => parseOccupants(app?.additionalOccupants), [app?.additionalOccupants]);
  const primaryIncome = moneyValue(app?.monthlyIncome);
  const additionalIncome = moneyValue(app?.additionalIncomeMonthly);
  const totalIncome = primaryIncome + additionalIncome;
  const proposedRent = moneyValue(convertForm.rentAmount);
  const incomeRatio = proposedRent > 0 ? totalIncome / proposedRent : null;
  const hasEmail = !!app?.email;
  const requirementState = app
    ? applicationRequirements({
        status: app.status,
        email: app.email,
        backgroundCheckStatus: app.backgroundCheckStatus,
        documents: docs,
      })
    : { missingDocuments: [], blockers: [] };
  const requiredDocsComplete = requirementState.missingDocuments.length === 0;
  const screeningStatus = app?.backgroundCheckStatus ?? "not_started";
  const screeningOk = screeningStatus === "passed" || screeningStatus === "conditional";
  const isApproved = app?.status === "approved";
  const isDenied = app?.status === "denied";
  const leaseStatus = app?.convertedLease?.signingStatus ?? null;
  const recommendation = getAdvisorRecommendation({ screeningStatus, incomeRatio, hasDocs: requiredDocsComplete, hasEmail });
  const approvalBlockers = [
    !hasEmail ? "Applicant email is missing." : null,
    !requiredDocsComplete ? requirementState.blockers.find((blocker) => blocker.startsWith("Required documents")) : null,
    !screeningOk ? "Credit/screening result must be passed or conditional." : null,
    !convertForm.startDate ? "Lease start date is required." : null,
    proposedRent <= 0 ? "Monthly rent is required." : null,
  ].filter((item): item is string => Boolean(item));
  const canApprove = approvalBlockers.length === 0 && !!app && !isApproved && !isDenied;

  async function updateApplication(body: Record<string, unknown>) {
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Update failed");
    return data;
  }

  function toggleDocumentRequestType(type: string) {
    setDocumentRequestTypes((current) => (
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type]
    ));
  }

  function openDocumentRequestDialog() {
    const defaults = requirementState.missingDocuments.length
      ? requirementState.missingDocuments
      : [];
    setDocumentRequestTypes(defaults);
    setDocumentRequestMessage(decisionNotes || "");
    setRequestDocsOpen(true);
  }

  async function handleSendDocumentRequest() {
    if (documentRequestTypes.length === 0) {
      toast.error("Select at least one document to request");
      return;
    }
    setSendingDocumentRequest(true);
    try {
      const data = await updateApplication({
        status: "documents_requested",
        decisionNotes: documentRequestMessage || decisionNotes,
        requestedDocumentTypes: documentRequestTypes,
        documentRequestMessage,
      });
      const sent = data.documentRequest?.emailSent;
      const emailError = data.documentRequest?.emailError;
      toast.success(sent ? "Document request sent to applicant" : `Request saved${emailError ? `; email not sent: ${emailError}` : ""}`);
      setRequestDocsOpen(false);
      await loadApp();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send document request");
    } finally {
      setSendingDocumentRequest(false);
    }
  }

  async function handleMarkUnderReview() {
    try {
      await updateApplication({ status: "under_review", decisionNotes });
      toast.success("Application moved to review");
      await loadApp();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update application");
    }
  }

  async function handleStartScreening() {
    try {
      await updateApplication({ status: "screening", decisionNotes });
      toast.success("Application moved to screening");
      await loadApp();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update application");
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      await updateApplication({ decisionNotes });
      toast.success("Decision notes saved");
      await loadApp();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleDeny() {
    setDenying(true);
    try {
      await updateApplication({ status: "denied", decisionNotes });
      toast.success("Application denied");
      await loadApp();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to deny application");
    } finally {
      setDenying(false);
    }
  }

  async function sendLeaseForId(leaseId: string) {
    setSendingLease(true);
    try {
      const res = await fetch(`/api/leases/${leaseId}/send-for-signing`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to send lease");
      setSignUrl(data.signUrl ?? "");
      toast.success("Lease sent to tenant for signing");
      await loadApp();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the lease");
      return false;
    } finally {
      setSendingLease(false);
    }
  }

  async function handleConvert() {
    if (!canApprove) {
      setGuardErrors(approvalBlockers);
      toast.error("Requirements are not complete");
      return;
    }
    setConverting(true);
    setGuardErrors([]);
    try {
      const res = await fetch(`/api/applications/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: convertForm.startDate,
          endDate: convertForm.endDate || undefined,
          rentAmount: proposedRent,
          depositAmount: moneyValue(convertForm.depositAmount),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (Array.isArray(data.guards)) setGuardErrors(data.guards);
        throw new Error(data.error ?? "Failed to approve application");
      }
      toast.success("Approved. Tenant and lease created.");
      setConvertOpen(false);
      if (sendLeaseAfterApproval && data.lease?.id) {
        await sendLeaseForId(data.lease.id);
      } else {
        await loadApp();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not approve application");
    } finally {
      setConverting(false);
    }
  }

  async function handleCountersign() {
    if (!app?.convertedLeaseId) return;
    setCountersigning(true);
    try {
      const res = await fetch(`/api/leases/${app.convertedLeaseId}/countersign`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to countersign");
      toast.success("Lease countersigned. Tenant is fully active.");
      await loadApp();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not countersign the lease");
    } finally {
      setCountersigning(false);
    }
  }

  if (!app) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/applications">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate font-heading text-3xl font-semibold leading-tight md:text-4xl">
              {app.firstName} {app.middleName ? `${app.middleName} ` : ""}{app.lastName}
            </h1>
            <Badge className={`border capitalize ${STATUS_COLOR[app.status] ?? "bg-muted"}`}>
              {app.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-base text-muted-foreground">
            {app.property ? (
              <Link href={`/properties/${app.property.id}`} className="hover:text-primary">
                {app.property.name}
              </Link>
            ) : "No property"}
            {app.unit ? ` - Unit ${app.unit.unitNumber}` : ""}
          </p>
        </div>
        {app.convertedTenantId && (
          <Link href={`/tenants/${app.convertedTenantId}`}>
            <Button variant="outline" size="sm">View tenant</Button>
          </Link>
        )}
        {app.convertedLeaseId && (
          <Link href={`/leases/${app.convertedLeaseId}`}>
            <Button variant="outline" size="sm">View lease</Button>
          </Link>
        )}
      </div>

      <div className="mb-5 rounded-xl border bg-primary/5 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <p className="text-[0.95rem] text-muted-foreground">Submitted</p>
            <p className="text-lg font-semibold">{shortDate(app.createdAt)}</p>
          </div>
          <div>
            <p className="text-[0.95rem] text-muted-foreground">Desired move-in</p>
            <p className="text-lg font-semibold">{shortDate(app.desiredMoveInDate)}</p>
          </div>
          <div>
            <p className="text-[0.95rem] text-muted-foreground">Household income</p>
            <p className="text-lg font-semibold">{totalIncome > 0 ? formatCurrency(totalIncome) : "--"}</p>
          </div>
          <div>
            <p className="text-[0.95rem] text-muted-foreground">Advisor recommendation</p>
            <p className="text-lg font-semibold">{recommendation.label}</p>
          </div>
        </div>
      </div>

      {signUrl && (
        <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-base">
          <p className="mb-1 flex items-center gap-2 font-medium text-blue-800">
            <KeyRound className="h-4 w-4" />
            Lease signing link
          </p>
          <a href={signUrl} target="_blank" rel="noreferrer" className="break-all font-mono text-[0.95rem] text-blue-700 hover:underline">
            {signUrl}
          </a>
        </div>
      )}

      {guardErrors.length > 0 && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-base text-red-800">
          {guardErrors.map((error) => <p key={error}>{error}</p>)}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <User className="h-5 w-5" />
                Applicant
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Field label="Email" value={app.email} />
              <Field label="Phone" value={app.phone} />
              <Field label="Date of birth" value={shortDate(app.dateOfBirth)} />
              <Field label="Current address" value={app.currentAddress} />
              <Field label="Emergency contact" value={app.emergencyContactName} />
              <Field label="Emergency phone" value={app.emergencyContactPhone} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Briefcase className="h-5 w-5" />
                Income And Employment
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Field label="Employer" value={app.employerName} />
              <Field label="Job title" value={app.jobTitle} />
              <Field label="Employer phone" value={app.employerPhone} />
              <Field label="Employment start" value={shortDate(app.employmentStartDate)} />
              <Field label="Monthly income" value={primaryIncome > 0 ? formatCurrency(primaryIncome) : "--"} />
              <Field label="Additional income" value={additionalIncome > 0 ? formatCurrency(additionalIncome) : "--"} />
              <Field label="Self employed" value={yesNo(app.selfEmployed)} />
              <div className="md:col-span-2">
                <LongField label="Additional income source" value={app.additionalIncomeSource} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Home className="h-5 w-5" />
                Residence And Household
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Current landlord" value={app.currentLandlordName} />
                <Field label="Landlord phone" value={app.currentLandlordPhone} />
                <Field label="Current address since" value={app.currentAddressStartDate} />
                <Field label="Previous address" value={app.previousAddress} />
                <Field label="Previous landlord" value={app.previousLandlordName} />
                <Field label="Previous landlord phone" value={app.previousLandlordPhone} />
                <Field label="People in household" value={app.numberOfOccupants} />
                <Field label="Lease term requested" value={app.intendedLeaseTerm} />
                <Field label="Signature date" value={shortDate(app.signedAt)} />
              </div>
              <LongField label="Reason for moving" value={app.reasonForMoving} />
              {occupants.length > 0 && (
                <div>
                  <p className="mb-2 text-[0.95rem] text-muted-foreground">Other occupants</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {occupants.map((occupant, index) => (
                      <div key={`${occupant.name}-${index}`} className="rounded-lg border p-4 text-base">
                        <p className="font-medium">{occupant.name || "Unnamed occupant"}</p>
                        <p className="text-[0.95rem] text-muted-foreground">
                          {[occupant.relationship, occupant.dateOfBirth].filter(Boolean).join(" - ") || "No details"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <AlertTriangle className="h-5 w-5" />
                Risk Disclosures
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <LongField label="Eviction history" value={app.everEvicted ? app.evictionExplanation || "Yes" : yesNo(app.everEvicted)} />
              <LongField label="Criminal history" value={app.hasCriminalHistory ? app.criminalHistoryExplanation || "Yes" : yesNo(app.hasCriminalHistory)} />
              <LongField label="Bankruptcy" value={app.hasBankruptcy ? app.bankruptcyExplanation || "Yes" : yesNo(app.hasBankruptcy)} />
              <LongField label="Applicant notes" value={app.additionalNotes} />
              <LongField label="Pets" value={app.hasPets ? app.petsDescription || "Yes" : "No"} />
              <LongField label="Vehicles" value={app.hasVehicles ? app.vehiclesDescription || "Yes" : "No"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentsSection
                applicationId={id}
                onDocsChange={(updated) => {
                  setDocs(updated);
                  setApp((current) => current ? { ...current, documents: updated } : null);
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <ClipboardCheck className="h-5 w-5" />
                References
              </CardTitle>
            </CardHeader>
            <CardContent>
              {app.references.length === 0 ? (
                <p className="text-base text-muted-foreground">No references submitted.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {app.references.map((reference) => (
                    <div key={reference.id} className="rounded-lg border p-4 text-base">
                      <div className="mb-2 flex items-center gap-2">
                        <p className="font-medium">{reference.name}</p>
                        <Badge variant="outline" className="capitalize">{reference.type}</Badge>
                      </div>
                      <p className="text-muted-foreground">{reference.relationship || "--"}</p>
                      <p>{reference.phone || "--"}</p>
                      <p>{reference.email || "--"}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <ClipboardCheck className="h-5 w-5" />
                Workflow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkflowVerificationPanel app={app} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <ShieldCheck className="h-5 w-5" />
                Credit Report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`rounded-lg border p-4 ${recommendation.tone}`}>
                <p className="font-medium">{recommendation.label}</p>
                <p className="mt-1 text-base leading-7">{recommendation.detail}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Status" value={SCREENING_LABEL[screeningStatus] ?? screeningStatus} />
                <Field label="Report date" value={shortDate(app.backgroundCheckDate)} />
              </div>
              <LongField label="Report notes" value={app.backgroundCheckNotes} />
              <Button variant="outline" className="w-full gap-2" onClick={() => setScreeningOpen(true)}>
                <ShieldCheck className="h-4 w-4" />
                {screeningStatus === "not_started" ? "Unlock / record report" : "Update report"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <DollarSign className="h-5 w-5" />
                Lease Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={convertForm.startDate}
                    onChange={(event) => setConvertForm((current) => ({ ...current, startDate: event.target.value }))}
                    disabled={isApproved}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End date</Label>
                  <Input
                    type="date"
                    value={convertForm.endDate}
                    onChange={(event) => setConvertForm((current) => ({ ...current, endDate: event.target.value }))}
                    disabled={isApproved}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Monthly rent</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={convertForm.rentAmount}
                    onChange={(event) => setConvertForm((current) => ({ ...current, rentAmount: event.target.value }))}
                    placeholder="1500.00"
                    disabled={isApproved}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Deposit</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={convertForm.depositAmount}
                    onChange={(event) => setConvertForm((current) => ({ ...current, depositAmount: event.target.value }))}
                    placeholder="1500.00"
                    disabled={isApproved}
                  />
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-base">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Rent to income</span>
                  <span className="font-medium">{incomeRatio === null ? "--" : `${incomeRatio.toFixed(1)}x`}</span>
                </div>
                <p className="mt-1 text-[0.95rem] leading-6 text-muted-foreground">
                  Enter monthly rent to check whether household income supports the lease.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <ClipboardCheck className="h-5 w-5" />
                Decision
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {approvalBlockers.length > 0 && !isApproved && !isDenied && (
                <div className="rounded-lg border bg-muted/30 p-4 text-base">
                  <p className="mb-2 font-medium">Before approval</p>
                  <div className="space-y-1.5">
                    {approvalBlockers.map((blocker) => (
                      <div key={blocker} className="flex gap-2 text-muted-foreground">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                        <span>{blocker}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Decision notes</Label>
                <Textarea
                  value={decisionNotes}
                  onChange={(event) => setDecisionNotes(event.target.value)}
                  rows={4}
                  placeholder="Reason for approval, denial, missing information, or lease conditions..."
                />
              </div>
              <Button variant="outline" className="w-full" onClick={handleSaveNotes} disabled={savingNotes}>
                {savingNotes ? "Saving..." : "Save notes"}
              </Button>

              <Separator />

              {!isApproved && !isDenied && (
                <div className="space-y-2">
                  <Button
                    className="w-full gap-2"
                    onClick={() => {
                      setGuardErrors(approvalBlockers);
                      setConvertOpen(true);
                    }}
                    disabled={!canApprove}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve and create lease
                  </Button>
                  <Button variant="outline" className="w-full" onClick={openDocumentRequestDialog}>
                    Request documents
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleMarkUnderReview}
                    disabled={app.status !== "documents_requested"}
                  >
                    Move to under review
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleStartScreening}
                    disabled={app.status !== "under_review"}
                  >
                    Move to screening
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={handleDeny}
                    disabled={denying}
                  >
                    <XCircle className="h-4 w-4" />
                    {denying ? "Denying..." : "Deny application"}
                  </Button>
                </div>
              )}

              {isApproved && app.convertedLeaseId && (
                <div className="space-y-2">
                  {leaseStatus === "draft" && (
                    <Button className="w-full gap-2" onClick={() => sendLeaseForId(app.convertedLeaseId!)} disabled={sendingLease}>
                      <Send className="h-4 w-4" />
                      {sendingLease ? "Sending..." : "Send lease for signing"}
                    </Button>
                  )}
                  {leaseStatus === "tenant_signed" && (
                    <Button className="w-full gap-2" onClick={handleCountersign} disabled={countersigning}>
                      <FileSignature className="h-4 w-4" />
                      {countersigning ? "Countersigning..." : "Countersign lease"}
                    </Button>
                  )}
                  <div className="rounded-lg border bg-muted/30 p-4 text-base">
                    <p className="font-medium">Lease status: {leaseStatus?.replace("_", " ") ?? "draft"}</p>
                    <p className="text-muted-foreground">Continue from the lease or tenant page after signatures are complete.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={screeningOpen} onOpenChange={setScreeningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credit Report And Screening</DialogTitle>
          </DialogHeader>
          <ScreeningSection
            applicationId={id}
            initialStatus={app.backgroundCheckStatus}
            initialNotes={app.backgroundCheckNotes}
            initialDate={app.backgroundCheckDate}
            onChange={async () => {
              await loadApp();
              setScreeningOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={requestDocsOpen} onOpenChange={setRequestDocsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Missing Documents</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-base">
              <p className="font-medium">Choose what the applicant needs to upload</p>
              <p className="mt-1 text-[0.95rem] leading-6 text-muted-foreground">
                The applicant will receive a secure link back to this application and can upload only the requested documents.
              </p>
            </div>

            <div className="space-y-2">
              {DOCUMENT_REQUEST_OPTIONS.map((option) => (
                <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-base transition-colors hover:bg-muted/30">
                  <input
                    type="checkbox"
                    checked={documentRequestTypes.includes(option.value)}
                    onChange={() => toggleDocumentRequestType(option.value)}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block font-medium">{option.label}</span>
                    <span className="block text-[0.95rem] leading-6 text-muted-foreground">{option.helper}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Message to applicant</Label>
              <Textarea
                value={documentRequestMessage}
                onChange={(event) => setDocumentRequestMessage(event.target.value)}
                rows={4}
                placeholder="Example: Please upload the most recent bank statement and a clearer image of your government ID."
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setRequestDocsOpen(false)} disabled={sendingDocumentRequest}>
                Cancel
              </Button>
              <Button onClick={handleSendDocumentRequest} disabled={sendingDocumentRequest || documentRequestTypes.length === 0}>
                {sendingDocumentRequest ? "Sending..." : "Confirm and send request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve And Create Lease</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className={`rounded-lg border p-3 ${recommendation.tone}`}>
              <p className="font-medium">{recommendation.label}</p>
              <p className="text-base leading-7">{recommendation.detail}</p>
            </div>
            {approvalBlockers.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-base text-red-800">
                {approvalBlockers.map((blocker) => <p key={blocker}>{blocker}</p>)}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lease start" value={convertForm.startDate || "--"} />
              <Field label="Lease end" value={convertForm.endDate || "Month to month"} />
              <Field label="Monthly rent" value={proposedRent > 0 ? formatCurrency(proposedRent) : "--"} />
              <Field label="Deposit" value={moneyValue(convertForm.depositAmount) > 0 ? formatCurrency(moneyValue(convertForm.depositAmount)) : "--"} />
            </div>
            <label className="flex items-center gap-2 rounded-lg border p-4 text-base">
              <input
                type="checkbox"
                checked={sendLeaseAfterApproval}
                onChange={(event) => setSendLeaseAfterApproval(event.target.checked)}
                className="h-4 w-4"
              />
              Send lease for tenant signature immediately after approval
            </label>
            <Button className="w-full" onClick={handleConvert} disabled={converting}>
              {converting ? "Creating..." : "Approve, create tenant, and generate lease"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
