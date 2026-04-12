"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Copy, Check, Send, Mail } from "lucide-react";

interface Unit { id: string; unitNumber: string }
interface Property { id: string; name: string; units: Unit[] }

export function InviteButton({ properties }: { properties: Property[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailName, setEmailName] = useState("");
  const [sending, setSending] = useState(false);

  const units = properties.find((p) => p.id === selectedProperty)?.units ?? [];

  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  async function handleGenerate() {
    if (!selectedProperty) { toast.error("Select a property first"); return; }
    setLoading(true);
    const res = await fetch("/api/applications/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: selectedProperty, unitId: selectedUnit || undefined }),
    });
    setLoading(false);
    if (!res.ok) { toast.error("Failed to generate invite link"); return; }
    const invite = await res.json();
    setGeneratedUrl(invite.applyUrl ?? `${window.location.origin}/apply/${invite.token}`);
  }

  async function handleSendEmail() {
    if (!selectedProperty || !emailTo) { toast.error("Property and email are required"); return; }
    setSending(true);
    setEmailWarning(null);
    const res = await fetch("/api/applications/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: selectedProperty, unitId: selectedUnit || undefined, sendToEmail: emailTo, sendToName: emailName }),
    });
    setSending(false);
    if (!res.ok) { toast.error("Failed to create invite"); return; }
    const invite = await res.json();
    setGeneratedUrl(invite.applyUrl ?? `${window.location.origin}/apply/${invite.token}`);
    if (invite.emailSent) {
      toast.success(`Invite emailed to ${emailTo}`);
    } else {
      setEmailWarning(`Email could not be sent to ${emailTo}. Share the link below directly.`);
    }
  }

  async function copyUrl() {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copied!");
  }

  function reset() { setGeneratedUrl(null); setSelectedProperty(""); setSelectedUnit(""); setCopied(false); setEmailTo(""); setEmailName(""); setEmailWarning(null); }

  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => { reset(); setOpen(true); }}>
        <Plus className="h-4 w-4" /> Send Application
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Send Rental Application</DialogTitle></DialogHeader>

          {!generatedUrl ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Property *</Label>
                <Select value={selectedProperty} onValueChange={(v) => { setSelectedProperty(v ?? ""); setSelectedUnit(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select a property" /></SelectTrigger>
                  <SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {units.length > 0 && (
                <div className="space-y-2">
                  <Label>Unit (optional)</Label>
                  <Select value={selectedUnit} onValueChange={(v) => setSelectedUnit(v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="Any unit" /></SelectTrigger>
                    <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2"><Mail className="h-4 w-4" /> Send via Email</p>
                <div className="space-y-1.5">
                  <Label>Applicant Name</Label>
                  <Input value={emailName} onChange={(e) => setEmailName(e.target.value)} placeholder="Jane Smith" />
                </div>
                <div className="space-y-1.5">
                  <Label>Applicant Email *</Label>
                  <Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="jane@example.com" />
                </div>
                <Button onClick={handleSendEmail} disabled={sending || !selectedProperty || !emailTo} className="w-full gap-2">
                  <Send className="h-4 w-4" /> {sending ? "Sending..." : "Send Invite Email"}
                </Button>
              </div>

              <div className="relative flex items-center gap-2">
                <div className="flex-1 border-t" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 border-t" />
              </div>

              <Button variant="outline" onClick={handleGenerate} disabled={loading || !selectedProperty} className="w-full">
                {loading ? "Generating…" : "Just generate a link to copy"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {emailWarning && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  ⚠ {emailWarning}
                </div>
              )}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Application link — share this with the applicant</p>
                <p className="text-sm font-mono break-all">{generatedUrl}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={copyUrl} className="flex-1 gap-2">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy link"}
                </Button>
                <Button variant="outline" onClick={() => { reset(); setOpen(false); }}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
