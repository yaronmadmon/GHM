"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewPropertyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        addressLine1: form.get("addressLine1"),
        addressLine2: form.get("addressLine2") || undefined,
        city: form.get("city"),
        state: form.get("state"),
        zip: form.get("zip"),
        propertyType: form.get("propertyType"),
        unitCount: parseInt(form.get("unitCount") as string) || 1,
        description: form.get("description") || undefined,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      toast.error("Failed to create property");
      return;
    }
    const property = await res.json();
    toast.success("Property created!");
    router.push(`/properties/${property.id}`);
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/properties">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold">Add property</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Property details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Property name *</Label>
              <Input id="name" name="name" placeholder="123 Main St" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="addressLine1">Street address *</Label>
              <Input id="addressLine1" name="addressLine1" placeholder="123 Main Street" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="addressLine2">Apt, Suite, Unit (optional)</Label>
              <Input id="addressLine2" name="addressLine2" placeholder="Suite 100" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="city">City *</Label>
                <Input id="city" name="city" placeholder="Austin" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <Input id="state" name="state" placeholder="TX" maxLength={2} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP code *</Label>
                <Input id="zip" name="zip" placeholder="78701" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitCount">Number of units</Label>
                <Input id="unitCount" name="unitCount" type="number" min={1} defaultValue={1} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Property type</Label>
              <Select name="propertyType" defaultValue="single_family">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_family">Single family</SelectItem>
                  <SelectItem value="multi_unit">Multi-unit</SelectItem>
                  <SelectItem value="condo">Condo</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea id="description" name="description" placeholder="Notes about this property..." rows={3} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating…" : "Create property"}
              </Button>
              <Link href="/properties">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
