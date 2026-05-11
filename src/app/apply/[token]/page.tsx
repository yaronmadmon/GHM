"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2, CheckCircle, AlertCircle, ChevronRight, ChevronLeft,
  Upload, X, FileText, ImageIcon, Loader2, Plus, Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface InviteInfo {
  propertyName: string;
  propertyAddress: string;
  unitNumber: string | null;
}

const STEPS = [
  "Personal Info",
  "Identity & Move-In",
  "Employment",
  "Rental History",
  "Background",
  "Household & Pets",
  "References",
  "Documents",
  "Review & Sign",
];

type Bool3 = "yes" | "no" | undefined;

// ─── Small helpers ────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      {children}
    </div>
  );
}

function YesNo({ value, onChange, name }: { value: Bool3; onChange: (v: Bool3) => void; name: string }) {
  return (
    <div className="flex gap-3" role="group" aria-label={name}>
      {(["yes", "no"] as const).map((opt) => (
        <button key={opt} type="button"
          className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors capitalize
            ${value === opt ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
          onClick={() => onChange(opt)}>
          {opt === "yes" ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

function SectionNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 bg-muted/60 rounded-lg text-xs text-muted-foreground leading-relaxed">
      {children}
    </div>
  );
}

// ─── Document Uploader ────────────────────────────────────────────────────────

interface UploadedDoc { name: string; url: string; docType: string; id?: string }

function DocUploader({
  label, docType, applicationId, token, docs, onAdd, onRemove,
}: {
  label: string; docType: string; applicationId: string; token: string;
  docs: UploadedDoc[]; onAdd: (d: UploadedDoc) => void; onRemove: (name: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) { toast.error("Max file size is 10 MB"); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("applicationId", applicationId);
    fd.append("docType", docType);
    const res = await fetch(`/api/apply/${token}/upload`, { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Upload failed — try again");
      return;
    }
    const doc = await res.json();
    onAdd({ name: file.name, url: doc.url ?? "[stored]", docType, id: doc.id });
    toast.success(`${file.name} uploaded`);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {docs.map((d) => (
        <div key={d.name} className="flex items-center gap-2 p-2 rounded-md bg-muted text-sm">
          {d.name.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" /> : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="flex-1 truncate">{d.name}</span>
          <button type="button" onClick={() => onRemove(d.name)} className="text-muted-foreground hover:text-destructive">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-md text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full justify-center disabled:opacity-50">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? "Uploading…" : "Upload file"}
      </button>
      <input ref={inputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApplyPage() {
  const { token } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [f, setF] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [docsSubmitted, setDocsSubmitted] = useState(false);

  useEffect(() => {
    const draft = localStorage.getItem(`ghm_app_${token}`);
    if (draft) try { setF(JSON.parse(draft)); } catch {}
    fetch(`/api/apply/${token}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setInvite(d); })
      .catch(() => setError("Failed to load. Please try again."));
  }, [token]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(updates: Record<string, any>) {
    const next = { ...f, ...updates };
    setF(next);
    localStorage.setItem(`ghm_app_${token}`, JSON.stringify(next));
  }

  function val(key: string, fallback = "") { return f[key] ?? fallback; }
  function bool3(key: string): Bool3 { const v = f[key]; return v === true || v === "yes" ? "yes" : v === false || v === "no" ? "no" : undefined; }
  function setBool(key: string, v: Bool3) { set({ [key]: v }); }

  // occupants
  const occupants: Array<{ name: string; relationship: string; dateOfBirth: string }> = f.additionalOccupants ?? [];
  function addOccupant() { set({ additionalOccupants: [...occupants, { name: "", relationship: "", dateOfBirth: "" }] }); }
  function updateOccupant(i: number, field: string, value: string) {
    const next = occupants.map((o, idx) => idx === i ? { ...o, [field]: value } : o);
    set({ additionalOccupants: next });
  }
  function removeOccupant(i: number) { set({ additionalOccupants: occupants.filter((_, idx) => idx !== i) }); }

  // references
  const refs: Array<{ type: string; name: string; relationship: string; phone: string; email: string }> = f.references ?? [];
  function addRef() { set({ references: [...refs, { type: "personal", name: "", relationship: "", phone: "", email: "" }] }); }
  function updateRef(i: number, field: string, value: string) {
    const next = refs.map((r, idx) => idx === i ? { ...r, [field]: value } : r);
    set({ references: next });
  }
  function removeRef(i: number) { set({ references: refs.filter((_, idx) => idx !== i) }); }

  // docs
  function addDoc(d: UploadedDoc) { setUploadedDocs((prev) => [...prev, d]); }
  function removeDoc(name: string) { setUploadedDocs((prev) => prev.filter((d) => d.name !== name)); }
  const docsByType = (type: string) => uploadedDocs.filter((d) => d.docType === type);

  function validate(): string | null {
    if (step === 0) {
      if (!val("firstName").trim()) return "First name is required";
      if (!val("lastName").trim()) return "Last name is required";
      if (!val("email").trim()) return "Email is required";
    }
    if (step === STEPS.length - 1) {
      if (!val("signatureData").trim()) return "Signature is required";
    }
    return null;
  }

  function next() {
    const err = validate();
    if (err) { toast.error(err); return; }
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function back() { setStep((s) => s - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function handleSubmit() {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    const res = await fetch(`/api/apply/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...f,
        monthlyIncome: f.monthlyIncome ? parseFloat(f.monthlyIncome) : undefined,
        additionalIncomeMonthly: f.additionalIncomeMonthly ? parseFloat(f.additionalIncomeMonthly) : undefined,
        numberOfOccupants: f.numberOfOccupants ? parseInt(f.numberOfOccupants) : undefined,
        hasPets: f.hasPets === "yes" || f.hasPets === true,
        hasVehicles: f.hasVehicles === "yes" || f.hasVehicles === true,
        selfEmployed: f.selfEmployed === "yes" || f.selfEmployed === true,
        everEvicted: f.everEvicted === "yes" ? true : f.everEvicted === "no" ? false : undefined,
        hasCriminalHistory: f.hasCriminalHistory === "yes" ? true : f.hasCriminalHistory === "no" ? false : undefined,
        hasBankruptcy: f.hasBankruptcy === "yes" ? true : f.hasBankruptcy === "no" ? false : undefined,
        references: (f.references ?? []).filter((r: { name: string }) => r.name?.trim()),
        additionalOccupants: (f.additionalOccupants ?? []).filter((o: { name: string }) => o.name?.trim()),
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      localStorage.removeItem(`ghm_app_${token}`);
      setApplicationId(data.id);
      setStep(STEPS.length); // move past last step to doc upload
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Submission failed. Please try again.");
    }
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full"><CardContent className="p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Invalid Link</h2>
        <p className="text-muted-foreground">{error}</p>
      </CardContent></Card>
    </div>
  );

  if (!invite) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading…</div>
    </div>
  );

  // Post-submit: document upload phase
  const hasId = docsByType("government_id").length > 0;
  const hasIncome = docsByType("pay_stub").length > 0;
  const requiredDone = hasId && hasIncome;

  if (applicationId) {
    if (docsSubmitted) return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <Card className="max-w-md w-full"><CardContent className="p-10 text-center">
          <CheckCircle className="h-14 w-14 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">You&apos;re all set!</h2>
          <p className="text-muted-foreground">
            Your application and documents for <strong>{invite.propertyName}</strong> have been submitted. The landlord will be in touch.
          </p>
        </CardContent></Card>
      </div>
    );

    return (
      <div className="min-h-screen bg-muted/20 py-10 px-4">
        <div className="max-w-xl mx-auto space-y-6">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-2xl font-semibold">Application submitted!</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Upload your documents to complete your application. Government ID and proof of income are required.
            </p>
          </div>

          {/* Required checklist */}
          <div className="flex gap-3">
            {[
              { label: "Government ID", done: hasId },
              { label: "Proof of Income", done: hasIncome },
            ].map(({ label, done }) => (
              <div key={label} className={`flex-1 flex items-center gap-2 p-3 rounded-lg border text-sm font-medium
                ${done ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                {done
                  ? <CheckCircle className="h-4 w-4 shrink-0" />
                  : <AlertCircle className="h-4 w-4 shrink-0" />}
                {label}
                {done ? " ✓" : " required"}
              </div>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Supporting Documents</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <DocUploader
                label="Government-issued Photo ID * (Driver's license, state ID, or passport)"
                docType="government_id" applicationId={applicationId} token={token}
                docs={docsByType("government_id")} onAdd={addDoc} onRemove={removeDoc}
              />
              <div className="border-t" />
              <DocUploader
                label="Proof of Income * (Pay stubs, offer letter, or benefits statement)"
                docType="pay_stub" applicationId={applicationId} token={token}
                docs={docsByType("pay_stub")} onAdd={addDoc} onRemove={removeDoc}
              />
              <div className="border-t" />
              <DocUploader
                label="Bank Statements — last 2–3 months (optional)"
                docType="bank_statement" applicationId={applicationId} token={token}
                docs={docsByType("bank_statement")} onAdd={addDoc} onRemove={removeDoc}
              />
              <div className="border-t" />
              <DocUploader
                label="Most Recent Tax Return — if self-employed (optional)"
                docType="tax_return" applicationId={applicationId} token={token}
                docs={docsByType("tax_return")} onAdd={addDoc} onRemove={removeDoc}
              />
              <div className="border-t" />
              <DocUploader
                label="Previous Lease Agreement (optional)"
                docType="previous_lease" applicationId={applicationId} token={token}
                docs={docsByType("previous_lease")} onAdd={addDoc} onRemove={removeDoc}
              />
              <SectionNote>
                * Required. Accepted formats: JPG, PNG, PDF, DOC. Max 8 MB per file. Your documents are only shared with the landlord.
              </SectionNote>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            disabled={!requiredDone}
            onClick={() => setDocsSubmitted(true)}
          >
            {requiredDone ? "Complete Application" : "Upload required documents to continue"}
          </Button>

          {!requiredDone && (
            <p className="text-center text-xs text-muted-foreground">
              {!hasId && !hasIncome
                ? "Government ID and proof of income are required."
                : !hasId
                ? "Please upload your government ID."
                : "Please upload your proof of income."}
            </p>
          )}
        </div>
      </div>
    );
  }

  const stepIdx = step;

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold">Rental Application</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {invite.propertyName}{invite.unitNumber && ` · Unit ${invite.unitNumber}`}
          </p>
          <p className="text-muted-foreground text-xs">{invite.propertyAddress}</p>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= stepIdx ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">Step {stepIdx + 1} of {STEPS.length} — {STEPS[stepIdx]}</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">{STEPS[stepIdx]}</CardTitle></CardHeader>
          <CardContent className="space-y-4">

            {/* ── Step 0: Personal Info ───────────────────────────────────── */}
            {stepIdx === 0 && <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name" required><Input value={val("firstName")} onChange={(e) => set({ firstName: e.target.value })} /></Field>
                <Field label="Last name" required><Input value={val("lastName")} onChange={(e) => set({ lastName: e.target.value })} /></Field>
              </div>
              <Field label="Middle name"><Input value={val("middleName")} onChange={(e) => set({ middleName: e.target.value })} /></Field>
              <Field label="Email" required><Input type="email" value={val("email")} onChange={(e) => set({ email: e.target.value })} /></Field>
              <Field label="Phone"><Input type="tel" value={val("phone")} onChange={(e) => set({ phone: e.target.value })} placeholder="(555) 555-5555" /></Field>
              <Field label="Date of birth"><Input type="date" value={val("dateOfBirth")} onChange={(e) => set({ dateOfBirth: e.target.value })} /></Field>
              <Field label="Social Security (last 4 digits only)">
                <Input value={val("ssnLast4")} maxLength={4} pattern="\d{4}" onChange={(e) => set({ ssnLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="XXXX" />
              </Field>
              <Field label="Current address"><Input value={val("currentAddress")} onChange={(e) => set({ currentAddress: e.target.value })} placeholder="Street, City, State, ZIP" /></Field>
              <Field label="Living at current address since">
                <Input type="month" value={val("currentAddressStartDate")} onChange={(e) => set({ currentAddressStartDate: e.target.value })} />
              </Field>
              <Field label="Emergency contact name"><Input value={val("emergencyContactName")} onChange={(e) => set({ emergencyContactName: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Emergency contact phone"><Input type="tel" value={val("emergencyContactPhone")} onChange={(e) => set({ emergencyContactPhone: e.target.value })} /></Field>
                <Field label="Relationship"><Input value={val("emergencyContactRelation")} onChange={(e) => set({ emergencyContactRelation: e.target.value })} placeholder="Parent, Sibling…" /></Field>
              </div>
            </>}

            {/* ── Step 1: Identity & Move-In ──────────────────────────────── */}
            {stepIdx === 1 && <>
              <Field label="Government ID type">
                <select value={val("governmentIdType")} onChange={(e) => set({ governmentIdType: e.target.value })}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40">
                  <option value="">Select…</option>
                  <option value="drivers_license">Driver's License</option>
                  <option value="state_id">State ID</option>
                  <option value="passport">Passport</option>
                  <option value="other">Other government ID</option>
                </select>
              </Field>
              <Field label="Desired move-in date"><Input type="date" value={val("desiredMoveInDate")} onChange={(e) => set({ desiredMoveInDate: e.target.value })} /></Field>
              <Field label="Intended lease term">
                <select value={val("intendedLeaseTerm")} onChange={(e) => set({ intendedLeaseTerm: e.target.value })}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40">
                  <option value="">Select…</option>
                  <option value="month-to-month">Month-to-month</option>
                  <option value="6 months">6 months</option>
                  <option value="12 months">12 months</option>
                  <option value="24 months">24 months</option>
                </select>
              </Field>
              <Field label="Total number of occupants (including yourself)">
                <Input type="number" min="1" max="20" value={val("numberOfOccupants")} onChange={(e) => set({ numberOfOccupants: e.target.value })} placeholder="1" />
              </Field>
              <SectionNote>
                All adults (18+) who will reside in the unit may be required to submit separate applications.
              </SectionNote>
            </>}

            {/* ── Step 2: Employment ──────────────────────────────────────── */}
            {stepIdx === 2 && <>
              <div className="space-y-2">
                <Label>Employment status</Label>
                <YesNo value={bool3("selfEmployed") === "yes" ? "yes" : bool3("selfEmployed") === "no" ? "no" : undefined} onChange={(v) => setBool("selfEmployed", v)} name="Self-employed" />
                <p className="text-xs text-muted-foreground">"Yes" = self-employed / freelance · "No" = employed by a company</p>
              </div>
              <Field label="Employer / Company name"><Input value={val("employerName")} onChange={(e) => set({ employerName: e.target.value })} /></Field>
              <Field label="Job title"><Input value={val("jobTitle")} onChange={(e) => set({ jobTitle: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start date"><Input type="date" value={val("employmentStartDate")} onChange={(e) => set({ employmentStartDate: e.target.value })} /></Field>
                <Field label="Employer phone"><Input type="tel" value={val("employerPhone")} onChange={(e) => set({ employerPhone: e.target.value })} /></Field>
              </div>
              <Field label="Gross monthly income ($)">
                <Input type="number" min="0" step="100" value={val("monthlyIncome")} onChange={(e) => set({ monthlyIncome: e.target.value })} placeholder="0.00" />
              </Field>
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Additional income source (optional)</p>
                <Field label="Source (e.g. Social Security, alimony, rental income)">
                  <Input value={val("additionalIncomeSource")} onChange={(e) => set({ additionalIncomeSource: e.target.value })} />
                </Field>
                <Field label="Monthly amount ($)">
                  <Input type="number" min="0" step="50" value={val("additionalIncomeMonthly")} onChange={(e) => set({ additionalIncomeMonthly: e.target.value })} placeholder="0.00" />
                </Field>
              </div>
            </>}

            {/* ── Step 3: Rental History ──────────────────────────────────── */}
            {stepIdx === 3 && <>
              <p className="text-sm text-muted-foreground">Current landlord / property manager</p>
              <Field label="Landlord name"><Input value={val("currentLandlordName")} onChange={(e) => set({ currentLandlordName: e.target.value })} /></Field>
              <Field label="Landlord phone"><Input type="tel" value={val("currentLandlordPhone")} onChange={(e) => set({ currentLandlordPhone: e.target.value })} /></Field>
              <Field label="Reason for moving"><Textarea rows={2} value={val("reasonForMoving")} onChange={(e) => set({ reasonForMoving: e.target.value })} /></Field>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-3">Previous address (if different)</p>
                <Field label="Previous address"><Input value={val("previousAddress")} onChange={(e) => set({ previousAddress: e.target.value })} placeholder="Street, City, State, ZIP" /></Field>
                <Field label="Previous landlord name"><Input value={val("previousLandlordName")} onChange={(e) => set({ previousLandlordName: e.target.value })} /></Field>
                <Field label="Previous landlord phone"><Input type="tel" value={val("previousLandlordPhone")} onChange={(e) => set({ previousLandlordPhone: e.target.value })} /></Field>
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">Have you ever been evicted or asked to vacate a property?</p>
                <YesNo value={bool3("everEvicted")} onChange={(v) => setBool("everEvicted", v)} name="Ever evicted" />
                {bool3("everEvicted") === "yes" && (
                  <Field label="Please explain">
                    <Textarea rows={3} value={val("evictionExplanation")} onChange={(e) => set({ evictionExplanation: e.target.value })} placeholder="Provide dates, addresses, and circumstances…" />
                  </Field>
                )}
              </div>
            </>}

            {/* ── Step 4: Background ─────────────────────────────────────── */}
            {stepIdx === 4 && <>
              <SectionNote>
                We are an equal opportunity housing provider. A criminal record does not automatically disqualify you.
                Each application is evaluated individually based on the nature and time of any offense and other factors.
                These questions are asked in compliance with applicable fair housing laws.
              </SectionNote>

              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Have you been convicted of a felony or a crime that would pose a direct threat to the health or safety of others, within the past 7 years?
                </p>
                <YesNo value={bool3("hasCriminalHistory")} onChange={(v) => setBool("hasCriminalHistory", v)} name="Criminal history" />
                {bool3("hasCriminalHistory") === "yes" && (
                  <Field label="Please describe (charge, year, jurisdiction)">
                    <Textarea rows={4} value={val("criminalHistoryExplanation")} onChange={(e) => set({ criminalHistoryExplanation: e.target.value })} placeholder="Provide context — type of offense, date, outcome, and any relevant circumstances…" />
                  </Field>
                )}
                <p className="text-xs text-muted-foreground">
                  Note: Arrests without conviction, expunged records, and juvenile adjudications are not required to be disclosed where prohibited by law.
                </p>
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">Have you filed for bankruptcy within the past 7 years?</p>
                <YesNo value={bool3("hasBankruptcy")} onChange={(v) => setBool("hasBankruptcy", v)} name="Bankruptcy" />
                {bool3("hasBankruptcy") === "yes" && (
                  <Field label="Please explain (type, year, current status)">
                    <Textarea rows={3} value={val("bankruptcyExplanation")} onChange={(e) => set({ bankruptcyExplanation: e.target.value })} placeholder="Chapter 7, Chapter 13, year filed, discharged or still active…" />
                  </Field>
                )}
              </div>
            </>}

            {/* ── Step 5: Household & Pets ────────────────────────────────── */}
            {stepIdx === 5 && <>
              <div className="space-y-3">
                <p className="text-sm font-medium">Additional occupants (other than yourself)</p>
                {occupants.map((o, i) => (
                  <div key={i} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Person {i + 1}</p>
                      <button type="button" onClick={() => removeOccupant(i)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Full name"><Input value={o.name} onChange={(e) => updateOccupant(i, "name", e.target.value)} placeholder="Full name" /></Field>
                      <Field label="Relationship"><Input value={o.relationship} onChange={(e) => updateOccupant(i, "relationship", e.target.value)} placeholder="Spouse, child…" /></Field>
                    </div>
                    <Field label="Date of birth"><Input type="date" value={o.dateOfBirth} onChange={(e) => updateOccupant(i, "dateOfBirth", e.target.value)} /></Field>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addOccupant} className="gap-2 w-full">
                  <Plus className="h-4 w-4" />Add occupant
                </Button>
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">Do you have pets?</p>
                <YesNo value={bool3("hasPets")} onChange={(v) => setBool("hasPets", v)} name="Pets" />
                {bool3("hasPets") === "yes" && (
                  <Field label="Describe your pets (type, breed, weight, age)">
                    <Textarea rows={2} value={val("petsDescription")} onChange={(e) => set({ petsDescription: e.target.value })} placeholder="e.g. Labrador mix, 45 lbs, 3 years old; 1 cat, neutered" />
                  </Field>
                )}
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">Do you have vehicles that will require parking?</p>
                <YesNo value={bool3("hasVehicles")} onChange={(v) => setBool("hasVehicles", v)} name="Vehicles" />
                {bool3("hasVehicles") === "yes" && (
                  <Field label="Describe your vehicles (year, make, model, color, plate)">
                    <Textarea rows={2} value={val("vehiclesDescription")} onChange={(e) => set({ vehiclesDescription: e.target.value })} placeholder="e.g. 2019 Honda Civic, silver, ABC-1234" />
                  </Field>
                )}
              </div>
            </>}

            {/* ── Step 6: References ──────────────────────────────────────── */}
            {stepIdx === 6 && <>
              <SectionNote>
                Please provide at least 2 references — ideally a previous landlord, an employer, and a personal reference.
                We may contact them as part of our review.
              </SectionNote>
              {refs.map((r, i) => (
                <div key={i} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reference {i + 1}</p>
                    <button type="button" onClick={() => removeRef(i)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Field label="Type">
                    <select value={r.type} onChange={(e) => updateRef(i, "type", e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40">
                      <option value="personal">Personal</option>
                      <option value="landlord">Previous Landlord</option>
                      <option value="employer">Employer</option>
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Name"><Input value={r.name} onChange={(e) => updateRef(i, "name", e.target.value)} /></Field>
                    <Field label="Relationship"><Input value={r.relationship} onChange={(e) => updateRef(i, "relationship", e.target.value)} placeholder="Manager, neighbor…" /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Phone"><Input type="tel" value={r.phone} onChange={(e) => updateRef(i, "phone", e.target.value)} /></Field>
                    <Field label="Email"><Input type="email" value={r.email} onChange={(e) => updateRef(i, "email", e.target.value)} /></Field>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addRef} className="gap-2 w-full">
                <Plus className="h-4 w-4" />Add reference
              </Button>
            </>}

            {/* ── Step 7: Documents ───────────────────────────────────────── */}
            {stepIdx === 7 && <>
              <SectionNote>
                Document upload is available after you submit your application. You can skip this step now — you will be
                prompted to upload your ID, pay stubs, and other documents on the next screen.
              </SectionNote>
              <p className="text-sm text-muted-foreground text-center py-4">
                Required: Government ID · Proof of Income<br />
                Optional: Bank Statements · Tax Returns · Previous Lease
              </p>
            </>}

            {/* ── Step 8: Review & Sign ───────────────────────────────────── */}
            {stepIdx === 8 && <>
              {/* Summary */}
              <div className="space-y-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="font-medium">Applicant</p>
                  <p className="text-muted-foreground">{val("firstName")} {val("middleName")} {val("lastName")}</p>
                  <p className="text-muted-foreground">{val("email")} · {val("phone")}</p>
                </div>
                {val("employerName") && (
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <p className="font-medium">Employment</p>
                    <p className="text-muted-foreground">{val("jobTitle")} at {val("employerName")}</p>
                    <p className="text-muted-foreground">Monthly income: ${parseFloat(val("monthlyIncome") || "0").toLocaleString()}</p>
                  </div>
                )}
                {occupants.filter(o => o.name).length > 0 && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="font-medium mb-1">Additional occupants</p>
                    {occupants.filter(o => o.name).map((o, i) => (
                      <p key={i} className="text-muted-foreground">{o.name} ({o.relationship})</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 bg-muted/50 rounded-lg text-xs text-muted-foreground leading-relaxed border">
                By signing below, I certify that all information provided in this application is complete, true, and accurate
                to the best of my knowledge. I authorize the landlord and/or their agents to verify the information provided,
                including credit history, employment, rental history, and criminal background (where permitted by law).
                I understand that any misrepresentation may result in denial of my application or termination of tenancy.
              </div>
              <Field label="Type your full legal name as your electronic signature" required>
                <Input value={val("signatureData")} onChange={(e) => set({ signatureData: e.target.value })} placeholder="Full legal name" className="font-serif text-lg" />
              </Field>
              <p className="text-xs text-muted-foreground">
                By typing your name, you agree that this constitutes your legal electronic signature on this application.
              </p>
              <Field label="Any additional information you'd like us to know (optional)">
                <Textarea rows={3} value={val("additionalNotes")} onChange={(e) => set({ additionalNotes: e.target.value })} placeholder="Anything that may help with your application…" />
              </Field>
            </>}

          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex gap-3 pb-8">
          {stepIdx > 0 && (
            <Button variant="outline" onClick={back} className="gap-2">
              <ChevronLeft className="h-4 w-4" />Back
            </Button>
          )}
          <div className="flex-1" />
          {stepIdx < STEPS.length - 1 ? (
            <Button onClick={next} className="gap-2">
              Next<ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || !val("signatureData").trim()} className="gap-2">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : "Submit Application"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
