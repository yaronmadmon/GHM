"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, AlertTriangle } from "lucide-react";

export default function PortalSetupPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/portal/setup/${token}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setUser(d); })
      .catch(() => setError("Failed to load invite"));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSubmitting(true);
    setError("");
    const res = await fetch(`/api/portal/setup/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setSubmitting(false);
    if (res.ok) { setDone(true); setTimeout(() => router.push("/login"), 2000); }
    else { const d = await res.json(); setError(d.error ?? "Failed to set up account"); }
  }

  if (error && !user) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
        <p className="font-medium text-lg">{error}</p>
      </div>
    </div>
  );

  if (!user) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;

  if (done) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <CheckCircle className="h-14 w-14 text-green-600 mx-auto" />
        <h1 className="text-2xl font-semibold">Account Created!</h1>
        <p className="text-muted-foreground">Redirecting you to login...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Up Your Tenant Portal</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Welcome, {user.name}! Create a password to access your portal.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user.email} disabled className="bg-muted" />
            </div>
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm Password *</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting || !password || !confirm} className="w-full">
              {submitting ? "Creating account..." : "Create Account & Log In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
