"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, HardHat, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

interface Vendor {
  id: string;
  name: string;
  trade: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

const EMPTY_FORM = { name: "", trade: "", email: "", phone: "", notes: "" };

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/vendors");
    if (res.ok) setVendors(await res.json());
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditing(v);
    setForm({ name: v.name, trade: v.trade ?? "", email: v.email ?? "", phone: v.phone ?? "", notes: v.notes ?? "" });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      trade: form.trade.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    if (editing) {
      const res = await fetch(`/api/vendors/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setVendors((v) => v.map((x) => x.id === editing.id ? updated : x));
        toast.success("Vendor updated");
        setDialogOpen(false);
      } else {
        toast.error("Failed to update vendor");
      }
    } else {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setVendors((v) => [...v, created]);
        toast.success("Vendor added");
        setDialogOpen(false);
      } else {
        toast.error("Failed to add vendor");
      }
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/vendors/${id}`, { method: "DELETE" });
    if (res.ok) {
      setVendors((v) => v.filter((x) => x.id !== id));
      toast.success("Vendor removed");
    } else {
      toast.error("Failed to delete vendor");
    }
    setDeleteId(null);
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vendors</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Contractors and service providers</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />Add Vendor
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm py-12 text-center">Loading...</div>
      ) : vendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-xl">
          <HardHat className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg">No vendors yet</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Add contractors for plumbing, electrical, HVAC, and more</p>
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add first vendor</Button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trade</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Notes</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{v.name}</td>
                    <td className="px-4 py-3">
                      {v.trade ? <Badge variant="outline" className="capitalize text-xs">{v.trade}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs space-y-0.5">
                      {v.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{v.phone}</div>}
                      {v.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{v.email}</div>}
                      {!v.phone && !v.email && "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">{v.notes || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(v)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(v.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {vendors.map((v) => (
              <Card key={v.id}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{v.name}</p>
                      {v.trade && <Badge variant="outline" className="text-xs capitalize mt-1">{v.trade}</Badge>}
                      <div className="text-xs text-muted-foreground mt-1.5 space-y-0.5">
                        {v.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{v.phone}</div>}
                        {v.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{v.email}</div>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(v)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(v.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="ABC Plumbing" />
            </div>
            <div className="space-y-1.5">
              <Label>Trade / Specialty</Label>
              <Input value={form.trade} onChange={(e) => setForm((f) => ({ ...f, trade: e.target.value }))} placeholder="Plumbing, HVAC, Electrical…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="555-0100" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="vendor@example.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Licensed, bonded, preferred rates…" className="resize-none" />
            </div>
            <div className="flex gap-3 pt-1">
              <Button onClick={handleSave} disabled={saving} className="flex-1">{saving ? "Saving…" : editing ? "Save Changes" : "Add Vendor"}</Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Vendor?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This vendor will be removed. Existing maintenance requests will not be affected.</p>
          <div className="flex gap-3 mt-2">
            <Button variant="destructive" className="flex-1" onClick={() => deleteId && handleDelete(deleteId)}>Remove</Button>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
