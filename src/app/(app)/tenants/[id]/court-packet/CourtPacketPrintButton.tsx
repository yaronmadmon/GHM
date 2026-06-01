"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function CourtPacketPrintButton() {
  return (
    <Button size="sm" className="gap-2" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      Print / Save as PDF
    </Button>
  );
}
