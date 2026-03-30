"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CheckCircle, AlertCircle, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

interface InviteInfo {
  propertyName: string;
  propertyAddress: string;
  unitNumber: string | null;
}

const STEPS = ["Personal Info", "Employment", "Rental History", "Pets & Vehicles", "Signature"];

type FormData = Record<string, unknown>;

export default function ApplyPage() {
  const { token } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [signature, setSignature] = useState("");

  useEffect(() => {
    // Load draft from localStorage
    const draft = localStorage.getItem(`ghm_application_${token}`);
    if (draft) try { setFormData(JSON.parse(draft)); } catch {}

    // Validate token
    fetch(`/api/apply/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setInvite(data);
      })
      .catch(() => setError("Failed to load invite. Please try again."));
  }, [token]);

  function updateForm(updates: FormData) {
    const next = { ...formData, ...updates };
    setFormData(next);
    localStorage.setItem(`ghm_application_${token}`, JSON.stringify(next));
  }

  async function handleSubmit() {
    if (!signature.trim()) { toast.error("Please provide your signature"); return; }
    setSubmitting(true);

    const res = await fetch(`/api/apply/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        signatureData: signature,
        monthlyIncome: formData.monthlyIncome ? parseFloat(String(formData.monthlyIncome)) : undefined,
        hasPets: formData.hasPets === "true" || formData.hasPets === true,
        hasVehicles: formData.hasVehicles === "true" || formData.hasVehicles === true,
      }),
    });

    setSubmitting(false);
    if (res.ok) {
      localStorage.removeItem(`ghm_application_${token}`);
      setSubmitted(true);
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Submission failed. Please try again.");
    }
  }

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Invalid Link</h2>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    </div>
  );

  if (!invite) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading…</div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <Card className="max-w-md w-full">
        <CardContent className="p-10 text-center">
          <CheckCircle className="h-14 w-14 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Application submitted!</h2>
          <p className="text-muted-foreground">Thank you for applying to <strong>{invite.propertyName}</strong>. The landlord will review your application and get back to you.</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/20 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold">Rental Application</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {invite.propertyName}
            {invite.unitNumber && ` · Unit ${invite.unitNumber}`}
          </p>
          <p className="text-muted-foreground text-xs">{invite.propertyAddress}</p>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{STEPS[step]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: Personal Info */}
            {step === 0 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>First name *</Label><Input name="firstName" defaultValue={formData.firstName as string} onChange={(e) => updateForm({ firstName: e.target.value })} required /></div>
                  <div className="space-y-2"><Label>Last name *</Label><Input name="lastName" defaultValue={formData.lastName as string} onChange={(e) => updateForm({ lastName: e.target.value })} required /></div>
                </div>
                <div className="space-y-2"><Label>Email *</Label><Input type="email" defaultValue={formData.email as string} onChange={(e) => updateForm({ email: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Phone</Label><Input type="tel" defaultValue={formData.phone as string} onChange={(e) => updateForm({ phone: e.target.value })} /></div>
                <div className="space-y-2"><Label>Date of birth</Label><Input type="date" defaultValue={formData.dateOfBirth as string} onChange={(e) => updateForm({ dateOfBirth: e.target.value })} /></div>
                <div className="space-y-2"><Label>Current address</Label><Input defaultValue={formData.currentAddress as string} onChange={(e) => updateForm({ currentAddress: e.target.value })} /></div>
              </>
            )}

            {/* Step 2: Employment */}
            {step === 1 && (
              <>
                <div className="space-y-2"><Label>Employer name</Label><Input defaultValue={formData.employerName as string} onChange={(e) => updateForm({ employerName: e.target.value })} /></div>
                <div className="space-y-2"><Label>Job title</Label><Input defaultValue={formData.jobTitle as string} onChange={(e) => updateForm({ jobTitle: e.target.value })} /></div>
                <div className="space-y-2"><Label>Monthly income ($)</Label><Input type="number" step="100" defaultValue={formData.monthlyIncome as string} onChange={(e) => updateForm({ monthlyIncome: e.target.value })} /></div>
                <div className="space-y-2"><Label>Employment start date</Label><Input type="date" defaultValue={formData.employmentStartDate as string} onChange={(e) => updateForm({ employmentStartDate: e.target.value })} /></div>
                <div className="space-y-2"><Label>Employer phone</Label><Input type="tel" defaultValue={formData.employerPhone as string} onChange={(e) => updateForm({ employerPhone: e.target.value })} /></div>
              </>
            )}

            {/* Step 3: Rental History */}
            {step === 2 && (
              <>
                <div className="space-y-2"><Label>Current landlord name</Label><Input defaultValue={formData.currentLandlordName as string} onChange={(e) => updateForm({ currentLandlordName: e.target.value })} /></div>
                <div className="space-y-2"><Label>Current landlord phone</Label><Input type="tel" defaultValue={formData.currentLandlordPhone as string} onChange={(e) => updateForm({ currentLandlordPhone: e.target.value })} /></div>
                <div className="space-y-2"><Label>Previous address</Label><Input defaultValue={formData.previousAddress as string} onChange={(e) => updateForm({ previousAddress: e.target.value })} /></div>
                <div className="space-y-2"><Label>Reason for moving</Label><Textarea rows={3} defaultValue={formData.reasonForMoving as string} onChange={(e) => updateForm({ reasonForMoving: e.target.value })} /></div>
              </>
            )}

            {/* Step 4: Pets & Vehicles */}
            {step === 3 && (
              <>
                <div className="space-y-3">
                  <Label>Do you have pets?</Label>
                  <div className="flex gap-3">
                    {["Yes", "No"].map((opt) => (
                      <button key={opt} type="button"
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${(opt === "Yes" ? formData.hasPets === "true" || formData.hasPets === true : formData.hasPets === "false" || formData.hasPets === false) ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                        onClick={() => updateForm({ hasPets: opt === "Yes" ? "true" : "false" })}>
                        {opt}
                      </button>
                    ))}
                  </div>
                  {(formData.hasPets === "true" || formData.hasPets === true) && (
                    <div className="space-y-2"><Label>Describe your pets</Label><Textarea rows={2} defaultValue={formData.petsDescription as string} onChange={(e) => updateForm({ petsDescription: e.target.value })} placeholder="Type, breed, weight…" /></div>
                  )}
                </div>
                <div className="space-y-3">
                  <Label>Do you have vehicles?</Label>
                  <div className="flex gap-3">
                    {["Yes", "No"].map((opt) => (
                      <button key={opt} type="button"
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${(opt === "Yes" ? formData.hasVehicles === "true" || formData.hasVehicles === true : formData.hasVehicles === "false" || formData.hasVehicles === false) ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                        onClick={() => updateForm({ hasVehicles: opt === "Yes" ? "true" : "false" })}>
                        {opt}
                      </button>
                    ))}
                  </div>
                  {(formData.hasVehicles === "true" || formData.hasVehicles === true) && (
                    <div className="space-y-2"><Label>Describe your vehicles</Label><Textarea rows={2} defaultValue={formData.vehiclesDescription as string} onChange={(e) => updateForm({ vehiclesDescription: e.target.value })} placeholder="Year, make, model, color, plate…" /></div>
                  )}
                </div>
              </>
            )}

            {/* Step 5: Signature */}
            {step === 4 && (
              <>
                <div className="p-4 bg-muted/50 rounded-lg text-xs text-muted-foreground leading-relaxed">
                  By signing below, I certify that all information provided in this application is true and accurate. I authorize the landlord to verify the information provided, including employment, rental history, and credit background.
                </div>
                <div className="space-y-2">
                  <Label>Type your full name as your signature *</Label>
                  <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Your full name" className="font-serif text-lg" />
                </div>
                <p className="text-xs text-muted-foreground">By typing your name above, you agree to the terms of this application.</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="gap-2">
              <ChevronLeft className="h-4 w-4" />Back
            </Button>
          )}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} className="gap-2">
              Next<ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || !signature.trim()}>
              {submitting ? "Submitting…" : "Submit application"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
