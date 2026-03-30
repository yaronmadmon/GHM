"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Menu, X, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Users, FileText, DollarSign, Wrench,
  ArrowUpDown, ClipboardList, MessageSquare,
} from "lucide-react";

const allNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/leases", label: "Leases", icon: FileText },
  { href: "/rent", label: "Rent", icon: DollarSign },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/financials", label: "Financials", icon: ArrowUpDown },
  { href: "/applications", label: "Applications", icon: ClipboardList },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/import-export", label: "Import / Export", icon: ArrowUpDown },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <header className="md:hidden sticky top-0 z-30 bg-background border-b flex items-center h-14 px-4 gap-3">
        <Link href="/dashboard" className="flex items-center gap-2 flex-1">
          <Building2 className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">GHM</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-md hover:bg-muted transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Slide-over menu */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed top-0 left-0 bottom-0 w-72 bg-background border-r z-50 flex flex-col md:hidden">
            <div className="flex items-center justify-between h-14 px-4 border-b">
              <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setOpen(false)}>
                <Building2 className="h-5 w-5 text-primary" />
                <span className="font-semibold">GHM</span>
              </Link>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-md hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3">
              <ul className="space-y-0.5 px-2">
                {allNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground/70 hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="p-3 border-t">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-3 px-3 py-2.5 w-full rounded-md text-sm font-medium text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
