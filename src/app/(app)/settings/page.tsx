"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { User, DollarSign, CreditCard, CheckCircle2, XCircle } from "lucide-react";

interface Profile {
  name: string;
  email: string;
}

interface LateFeeConfig {
  gracePeriodDays: number;
  feeType: string;
  flatAmount: number | null;
  percentage: number | null;
  maxFeeAmount: number | null;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>({ name: "", email: "" });
  const [lateFee, setLateFee] = useState<LateFeeConfig>({
    gracePeriodDays: 5,
    feeType: "flat",
    flatAmount: 50,
    percentage: null,
    maxFeeAmount: null,
  });
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<{ connected: boolean; accountId: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/settings/profile").then((r) => r.json()).then((d) => {
      if (d.name !== undefined) setProfile({ name: d.name ?? "", email: d.email ?? "" });
    }).catch(() => {});

    fetch("/api/settings/late-fees").then((r) => r.json()).then((d) => {
      if (d.feeType) setLateFee(d);
    }).catch(() => {});

    fetch("/api/settings/stripe-status").then((r) => r.json()).then((d) => {
      setStripeStatus(d);
    }).catch(() => {});
  }, []);

  async function saveProfile() {
    setSaving("profile");
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: profile.name }),
    });
    setSaving(null);
    if (res.ok) toast.success("Profile saved");
    else toast.error("Failed to save");
  }

  async function savePassword() {
    if (password.next !== password.confirm) { toast.error("Passwords don't match"); return; }
    if (password.next.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setSaving("password");
    const res = await fetch("/api/settings/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: password.current, newPassword: password.next }),
    });
    setSaving(null);
    if (res.ok) { toast.success("Password updated"); setPassword({ current: "", next: "", confirm: "" }); }
    else { const d = await res.json(); toast.error(d.error ?? "Failed to update password"); }
  }

  async function disconnectStripe() {
    setSaving("stripe");
    await fetch("/api/settings/stripe-status", { method: "DELETE" });
    setStripeStatus({ connected: false, accountId: null });
    setSaving(null);
    toast.success("Stripe disconnected");
  }

  async function saveLateFees() {
    setSaving("latefees");
    const res = await fetch("/api/settings/late-fees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lateFee),
    });
    setSaving(null);
    if (res.ok) toast.success("Late fee settings saved");
    else toast.error("Failed to save");
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4 md:space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Profile</CardTitle>
          <CardDescription>Update your name and view your email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={profile.email} disabled className="bg-muted" />
          </div>
          <Button onClick={saveProfile} disabled={saving === "profile"}>
            {saving === "profile" ? "Saving..." : "Save Profile"}
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Current Password</Label>
            <Input type="password" value={password.current} onChange={(e) => setPassword((p) => ({ ...p, current: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input type="password" value={password.next} onChange={(e) => setPassword((p) => ({ ...p, next: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <Input type="password" value={password.confirm} onChange={(e) => setPassword((p) => ({ ...p, confirm: e.target.value }))} />
          </div>
          <Button onClick={savePassword} disabled={saving === "password" || !password.current || !password.next}>
            {saving === "password" ? "Updating..." : "Update Password"}
          </Button>
        </CardContent>
      </Card>

      {/* Stripe Connect */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Online Payments (Stripe)</CardTitle>
          <CardDescription>Connect your Stripe account so tenants can pay rent online. They pay the processing fee on top of rent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stripeStatus === null ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : stripeStatus.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                <CheckCircle2 className="h-4 w-4" /> Stripe account connected
              </div>
              <p className="text-xs text-muted-foreground">Tenants can now pay rent from their portal. Payments go directly to your Stripe account.</p>
              <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={disconnectStripe} disabled={saving === "stripe"}>
                <XCircle className="h-4 w-4" />{saving === "stripe" ? "Disconnecting..." : "Disconnect Stripe"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Not connected. Click below to link your Stripe account — takes about 2 minutes.</p>
              <a href="/api/stripe/connect">
                <Button className="gap-2"><CreditCard className="h-4 w-4" />Connect Stripe Account</Button>
              </a>
              <p className="text-xs text-muted-foreground">No Stripe account? You can create one for free during setup at stripe.com.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Late Fee Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Late Fee Settings</CardTitle>
          <CardDescription>Configure how late fees are calculated for overdue rent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Grace Period (days)</Label>
            <Input
              type="number"
              value={lateFee.gracePeriodDays}
              onChange={(e) => setLateFee((f) => ({ ...f, gracePeriodDays: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Fee Type</Label>
            <Select value={lateFee.feeType} onValueChange={(v) => setLateFee((f) => ({ ...f, feeType: v ?? "flat" }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">Flat amount</SelectItem>
                <SelectItem value="percentage">Percentage of rent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {lateFee.feeType === "flat" ? (
            <div className="space-y-1.5">
              <Label>Flat Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={lateFee.flatAmount ?? ""}
                onChange={(e) => setLateFee((f) => ({ ...f, flatAmount: parseFloat(e.target.value) || null }))}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Percentage (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={lateFee.percentage ?? ""}
                onChange={(e) => setLateFee((f) => ({ ...f, percentage: parseFloat(e.target.value) || null }))}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Maximum Fee Cap ($, optional)</Label>
            <Input
              type="number"
              step="0.01"
              value={lateFee.maxFeeAmount ?? ""}
              onChange={(e) => setLateFee((f) => ({ ...f, maxFeeAmount: parseFloat(e.target.value) || null }))}
              placeholder="No cap"
            />
          </div>
          <Button onClick={saveLateFees} disabled={saving === "latefees"}>
            {saving === "latefees" ? "Saving..." : "Save Late Fee Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
