"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TenantData {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | null;
  ssnLast4?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  notes?: string | null;
}

export function TenantActions({ tenant }: { tenant: TenantData }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    firstName: tenant.firstName,
    lastName: tenant.lastName,
    email: tenant.email ?? "",
    phone: tenant.phone ?? "",
    dateOfBirth: tenant.dateOfBirth ? new Date(tenant.dateOfBirth).toISOString().split("T")[0] : "",
    ssnLast4: tenant.ssnLast4 ?? "",
    emergencyContactName: tenant.emergencyContactName ?? "",
    emergencyContactPhone: tenant.emergencyContactPhone ?? "",
    notes: tenant.notes ?? "",
  });

  function field(name: keyof typeof form) {
    return {
      value: form[name],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [name]: e.target.value })),
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          dateOfBirth: form.dateOfBirth || null,
          ssnLast4: form.ssnLast4.trim() || null,
          emergencyContactName: form.emergencyContactName.trim() || null,
          emergencyContactPhone: form.emergencyContactPhone.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed to save"); return; }
      toast.success("Tenant updated");
      setEditOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/tenants/${tenant.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed to delete"); return; }
      toast.success("Tenant removed");
      router.push("/tenants");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-2" onClick={() => setEditOpen(true)}>
        <Pencil className="h-4 w-4" />Edit
      </Button>
      <Button size="sm" variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="h-4 w-4" />Delete
      </Button>

      {/* Edit Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Tenant</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSave} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First name *</Label>
                <Input {...field("firstName")} required />
              </div>
              <div className="space-y-1.5">
                <Label>Last name *</Label>
                <Input {...field("lastName")} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input {...field("email")} type="email" placeholder="—" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...field("phone")} placeholder="—" />
            </div>
            <div className="space-y-1.5">
              <Label>Date of birth</Label>
              <Input {...field("dateOfBirth")} type="date" />
            </div>
            <div className="space-y-1.5">
              <Label>SSN (last 4 digits)</Label>
              <Input {...field("ssnLast4")} maxLength={4} placeholder="—" />
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Emergency Contact</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input {...field("emergencyContactName")} placeholder="—" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input {...field("emergencyContactPhone")} placeholder="—" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/40"
                rows={3}
                {...field("notes")}
                placeholder="Any additional notes…"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tenant?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{tenant.firstName} {tenant.lastName}</strong> and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete tenant"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
