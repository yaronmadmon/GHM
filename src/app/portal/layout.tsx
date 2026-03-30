import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, Home, FileText, Wrench, MessageSquare, DollarSign } from "lucide-react";

const portalNav = [
  { href: "/portal", label: "Home", icon: Home },
  { href: "/portal/lease", label: "My Lease", icon: FileText },
  { href: "/portal/payments", label: "Payments", icon: DollarSign },
  { href: "/portal/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/portal/messages", label: "Messages", icon: MessageSquare },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "tenant") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="bg-background border-b sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 flex items-center h-14 gap-4">
          <Building2 className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Tenant Portal</span>
          <nav className="flex gap-1 ml-4">
            {portalNav.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
