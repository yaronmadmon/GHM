import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tenant Portal",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
