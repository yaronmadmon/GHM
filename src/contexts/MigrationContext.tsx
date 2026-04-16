"use client";

import { createContext, useContext, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ExtractedTenant } from "@/app/api/import/smart/route";

type MigrationStatus = "idle" | "processing" | "done" | "error";

interface MigrationContextValue {
  status: MigrationStatus;
  fileName: string;
  records: ExtractedTenant[];
  truncated: boolean;
  startExtraction: (file: File) => void;
  clearResult: () => void;
}

const MigrationContext = createContext<MigrationContextValue | null>(null);

export function useMigrationContext() {
  const ctx = useContext(MigrationContext);
  if (!ctx) throw new Error("useMigrationContext must be used inside MigrationProvider");
  return ctx;
}

export function MigrationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<MigrationStatus>("idle");
  const [fileName, setFileName] = useState("");
  const [records, setRecords] = useState<ExtractedTenant[]>([]);
  const [truncated, setTruncated] = useState(false);
  // Keep a ref so we can dismiss the "processing" toast when done
  const processingToastId = useRef<string | number | undefined>(undefined);

  const clearResult = useCallback(() => {
    setStatus("idle");
    setFileName("");
    setRecords([]);
    setTruncated(false);
  }, []);

  const startExtraction = useCallback(async (file: File) => {
    // Dismiss any previous result toast
    if (processingToastId.current != null) toast.dismiss(processingToastId.current);

    const name = file.name.replace(/\.[^.]+$/, ""); // strip extension
    setFileName(name);
    setStatus("processing");
    setRecords([]);

    // Show a persistent "processing" toast so the user sees it on other pages
    processingToastId.current = toast.loading(`Reading ${name}…`, { duration: Infinity });

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/import/smart?action=extract", { method: "POST", body: fd });
      const data = await res.json();

      toast.dismiss(processingToastId.current);

      if (!res.ok || data.error) {
        setStatus("error");
        toast.error(data.error ?? "Failed to read file");
        return;
      }

      if (!data.extracted?.length) {
        setStatus("error");
        toast.error("No tenant records found. Try including names, addresses, or rent amounts.");
        return;
      }

      // Check conflicts
      const emails = (data.extracted as ExtractedTenant[]).map((r) => r.email).filter(Boolean);
      if (emails.length) {
        try {
          const cr = await fetch("/api/import/smart?action=check-conflicts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emails }),
          });
          if (cr.ok) {
            const cd = await cr.json();
            // Attach conflict flag inline so the migration page can use it
            const existingEmails = new Set<string>(cd.existing ?? []);
            (data.extracted as ExtractedTenant[]).forEach((r: ExtractedTenant & { _conflict?: boolean }) => {
              if (r.email && existingEmails.has(r.email)) r._conflict = true;
            });
          }
        } catch { /* conflicts are non-critical */ }
      }

      setRecords(data.extracted);
      setTruncated(data.truncated ?? false);
      setStatus("done");

      const count = data.extracted.length;
      toast.success(
        `Found ${count} tenant${count !== 1 ? "s" : ""} in "${name}"`,
        {
          duration: Infinity,
          action: {
            label: "Review →",
            onClick: () => router.push("/migration"),
          },
        }
      );
    } catch {
      toast.dismiss(processingToastId.current);
      setStatus("error");
      toast.error("Something went wrong. Please try again.");
    }
  }, [router]);

  return (
    <MigrationContext.Provider value={{ status, fileName, records, truncated, startExtraction, clearResult }}>
      {children}
    </MigrationContext.Provider>
  );
}
