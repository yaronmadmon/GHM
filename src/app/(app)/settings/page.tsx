"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { User, Building2, DollarSign } from "lucide-react";

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

  useEffect(() => {
    fetch("/api/settings/profile").then((r) => r.json()).then((d) => {
      if (d.name !== undefined) setProfile({ name: d.name ?? "", email: d.email ?? "" });
    }).catch(() => {});

    fetch("/api/settings/late-fees").then((r) => r.json()).then((d) => {
      if (d.feeType) setLateFee(d);
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
