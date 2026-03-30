"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link, Plus, Copy, Check } from "lucide-react";

interface Unit { id: string; unitNumber: string }
interface Property { id: string; name: string; units: Unit[] }

interface InviteButtonProps {
  properties: Property[];
}

export function InviteButton({ properties }: InviteButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");

  const units = properties.find((p) => p.id === selectedProperty)?.units ?? [];

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
    const url = `${window.location.origin}/apply/${invite.token}`;
    setGeneratedUrl(url);
  }

  async function copyUrl() {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copied!");
  }

  function reset() {
    setGeneratedUrl(null);
    setSelectedProperty("");
    setSelectedUnit("");
    setCopied(false);
  }

  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => { reset(); setOpen(true); }}>
        <Plus className="h-4 w-4" />
        Generate invite link
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate application invite link</DialogTitle>
          </DialogHeader>

          {!generatedUrl ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Property *</Label>
                <Select value={selectedProperty} onValueChange={(v) => { setSelectedProperty(v ?? ""); setSelectedUnit(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select a property" /></SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {units.length > 0 && (
                <div className="space-y-2">
                  <Label>Unit (optional)</Label>
                  <Select value={selectedUnit} onValueChange={(v) => setSelectedUnit(v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="Any unit" /></SelectTrigger>
                    <SelectContent>
                      {units.map((u) => <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button onClick={handleGenerate} disabled={loading || !selectedProperty} className="flex-1">
                  {loading ? "Generating…" : "Generate link"}
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Share this link with prospective tenants</p>
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
