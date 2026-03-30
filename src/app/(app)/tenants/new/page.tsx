"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewTenantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email: form.get("email") || undefined,
        phone: form.get("phone") || undefined,
        emergencyContactName: form.get("emergencyContactName") || undefined,
        emergencyContactPhone: form.get("emergencyContactPhone") || undefined,
        notes: form.get("notes") || undefined,
      }),
    });

    setLoading(false);
    if (!res.ok) { toast.error("Failed to create tenant"); return; }
    const tenant = await res.json();
    toast.success("Tenant added!");
    router.push(`/tenants/${tenant.id}`);
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tenants"><Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-semibold">Add tenant</h1>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Tenant information</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>First name *</Label>
                <Input name="firstName" placeholder="Jane" required />
              </div>
              <div className="space-y-2">
                <Label>Last name *</Label>
                <Input name="lastName" placeholder="Smith" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input name="email" type="email" placeholder="jane@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input name="phone" placeholder="(512) 555-0100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Emergency contact name</Label>
                <Input name="emergencyContactName" placeholder="John Smith" />
              </div>
              <div className="space-y-2">
                <Label>Emergency contact phone</Label>
                <Input name="emergencyContactPhone" placeholder="(512) 555-0101" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea name="notes" placeholder="Any notes about this tenant..." rows={3} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Add tenant"}</Button>
              <Link href="/tenants"><Button type="button" variant="outline">Cancel</Button></Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
