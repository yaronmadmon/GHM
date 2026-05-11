"use client";

import { Button } from "@/components/ui/button";
import { Printer, FileText } from "lucide-react";

export function ReportPrintControls() {
  function printDoc(cls: string) {
    document.documentElement.classList.add(cls);
    window.print();
    window.addEventListener("afterprint", () => {
      document.documentElement.classList.remove(cls);
    }, { once: true });
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button className="gap-2" onClick={() => printDoc("print-full")}>
        <Printer className="h-4 w-4" />
        Print Full Report
      </Button>
      <Button variant="outline" className="gap-2" onClick={() => printDoc("print-clean")}>
        <FileText className="h-4 w-4" />
        Print Rent Roll (Broker)
      </Button>
    </div>
  );
}
