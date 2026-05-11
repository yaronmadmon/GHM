"use client";

import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function VacancyListingActions({ description }: { description: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(description);
    setCopied(true);
    toast.success("Listing description copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" size="sm" className="w-full gap-2" onClick={copy}>
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied!" : "Copy listing description"}
    </Button>
  );
}
