"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, FileText, AlertTriangle } from "lucide-react";

interface LeaseInfo {
  id: string;
  status: string;
  tenantSigned: boolean;
  property: string;
  unit: string;
  startDate: string;
  endDate: string | null;
  rentAmount: number;
  depositAmount: number;
  tenantName: string;
}

function formatCurrency(n: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n); }
function formatDate(d: string) { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }

export default function LeaseSignPage() {
  const { token } = useParams<{ token: string }>();
  const [lease, setLease] = useState<LeaseInfo | null>(null);
  const [error, setError] = useState("");
  const [signature, setSignature] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/lease-sign/${token}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setLease(d); })
      .catch(() => setError("Failed to load lease"));
  }, [token]);

  async function handleSign() {
    if (!signature.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/lease-sign/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signature }),
    });
    setSubmitting(false);
    if (res.ok) { setDone(true); }
    else { const d = await res.json(); setError(d.error ?? "Failed to submit signature"); }
  }

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
        <p className="font-medium text-lg">{error}</p>
      </div>
    </div>
  );

  if (!lease) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;

  if (done || lease.tenantSigned) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <CheckCircle className="h-14 w-14 text-green-600 mx-auto" />
        <h1 className="text-2xl font-semibold">Lease Signed!</h1>
        <p className="text-muted-foreground">
          Thank you, {lease.tenantName}. Your signature has been recorded. Your landlord will countersign and you'll receive a confirmation.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-primary" />
          <h1 className="text-2xl font-semibold">Lease Agreement</h1>
          <p className="text-muted-foreground mt-1">Please review and sign your lease</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Lease Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-muted-foreground">Property</p><p className="font-medium">{lease.property}</p></div>
              <div><p className="text-muted-foreground">Unit</p><p className="font-medium">Unit {lease.unit}</p></div>
              <div><p className="text-muted-foreground">Start Date</p><p className="font-medium">{formatDate(lease.startDate)}</p></div>
              <div><p className="text-muted-foreground">End Date</p><p className="font-medium">{lease.endDate ? formatDate(lease.endDate) : "Month-to-month"}</p></div>
              <div><p className="text-muted-foreground">Monthly Rent</p><p className="font-medium">{formatCurrency(lease.rentAmount)}</p></div>
              <div><p className="text-muted-foreground">Security Deposit</p><p className="font-medium">{formatCurrency(lease.depositAmount)}</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lease Terms</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
            <p>This Lease Agreement ("Agreement") is entered into between the Landlord and the Tenant named above.</p>
            <p><strong>1. RENT.</strong> Tenant agrees to pay the monthly rent amount specified above, due on the 1st of each month. Late payments may be subject to a late fee per the Landlord's policy.</p>
            <p><strong>2. SECURITY DEPOSIT.</strong> Tenant agrees to pay the security deposit specified above prior to move-in. The deposit will be returned within 30 days of move-out, less any deductions for damages beyond normal wear and tear.</p>
            <p><strong>3. USE OF PREMISES.</strong> The premises shall be used for residential purposes only. Tenant shall comply with all laws, ordinances, and regulations applicable to the premises.</p>
            <p><strong>4. MAINTENANCE.</strong> Tenant shall keep the premises in a clean and sanitary condition and shall promptly notify the Landlord of any maintenance issues.</p>
            <p><strong>5. TERMINATION.</strong> Either party may terminate this agreement with proper notice as required by applicable law. For fixed-term leases, early termination may be subject to penalties.</p>
            <p><strong>6. ENTIRE AGREEMENT.</strong> This agreement constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, or agreements.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sign Here</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">By typing your full legal name below and clicking "Sign Lease", you agree to all terms above and acknowledge this constitutes a legally binding electronic signature.</p>
            <div className="space-y-1.5">
              <Label>Full Legal Name *</Label>
              <Input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder={lease.tenantName}
                className="font-semibold text-lg"
              />
            </div>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="agree"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="agree" className="text-sm text-muted-foreground cursor-pointer">
                I have read and agree to all terms of this lease agreement and understand this is a legally binding electronic signature.
              </label>
            </div>
            <Button
              onClick={handleSign}
              disabled={submitting || !signature.trim() || !agreed}
              className="w-full"
              size="lg"
            >
              {submitting ? "Signing..." : "Sign Lease"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
