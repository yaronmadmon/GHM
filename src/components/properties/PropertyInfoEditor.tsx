"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

type PropertyInfo = {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  status: string;
  description?: string | null;
  purchasePrice?: number | null;
  purchaseDate?: Date | null;
};

export function PropertyInfoEditor({
  property,
  variant = "outline",
}: {
  property: PropertyInfo;
  variant?: "outline" | "ghost";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: property.name,
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2 ?? "",
    city: property.city,
    state: property.state,
    zip: property.zip,
    propertyType: property.propertyType,
    status: property.status,
    description: property.description ?? "",
    purchasePrice: property.purchasePrice != null ? String(property.purchasePrice) : "",
    purchaseDate: property.purchaseDate ? new Date(property.purchaseDate).toISOString().split("T")[0] : "",
  });

  function field(name: keyof typeof form) {
    return {
      value: form[name],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((current) => ({ ...current, [name]: event.target.value })),
    };
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          addressLine1: form.addressLine1.trim(),
          addressLine2: form.addressLine2.trim() || null,
          city: form.city.trim(),
          state: form.state.trim(),
          zip: form.zip.trim(),
          propertyType: form.propertyType,
          status: form.status,
          description: form.description.trim() || null,
          purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
          purchaseDate: form.purchaseDate || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to save property");
        return;
      }
      toast.success("Property updated");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant={variant} className="gap-2" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Property</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSave} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Property name *</Label>
              <Input {...field("name")} required />
            </div>
            <div className="space-y-1.5">
              <Label>Address line 1 *</Label>
              <Input {...field("addressLine1")} required />
            </div>
            <div className="space-y-1.5">
              <Label>Address line 2</Label>
              <Input {...field("addressLine2")} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>City *</Label>
                <Input {...field("city")} required />
              </div>
              <div className="space-y-1.5">
                <Label>State *</Label>
                <Input {...field("state")} required maxLength={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Zip *</Label>
                <Input {...field("zip")} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Property type</Label>
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" {...field("propertyType")}>
                  <option value="single_family">Single family</option>
                  <option value="multi_unit">Multi unit</option>
                  <option value="condo">Condo</option>
                  <option value="commercial">Commercial</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" {...field("status")}>
                  <option value="occupied">Occupied</option>
                  <option value="vacant">Vacant</option>
                  <option value="under_maintenance">Under maintenance</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Purchase price</Label>
                <Input {...field("purchasePrice")} type="number" min="0" step="0.01" />
              </div>
              <div className="space-y-1.5">
                <Label>Purchase date</Label>
                <Input {...field("purchaseDate")} type="date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                rows={4}
                {...field("description")}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Saving..." : "Save changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
