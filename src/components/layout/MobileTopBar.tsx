"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ArrowUpDown,
  Bot,
  Building2,
  CalendarDays,
  ClipboardList,
  DollarSign,
  DoorOpen,
  FileText,
  FolderOpen,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  RefreshCw,
  Settings,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { GlobalSearchTrigger } from "@/components/GlobalSearch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const allNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/vacancy", label: "Vacancy", icon: DoorOpen },
  { href: "/applications", label: "Applications", icon: ClipboardList },
  { href: "/leases", label: "Leases", icon: FileText },
  { href: "/renewals", label: "Renewals", icon: RefreshCw },
  { href: "/rent", label: "Rent", icon: DollarSign },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/vendors", label: "Vendors", icon: HardHat },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/financials", label: "Financials", icon: ArrowUpDown },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/agent", label: "Agent Ops", icon: Bot },
  { href: "/import-export", label: "Import / Export", icon: ArrowUpDown },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileTopBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/94 px-3 backdrop-blur md:hidden">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-card text-primary shadow-sm">
            <span className="font-heading text-xl font-semibold leading-none">G</span>
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block font-heading text-2xl font-semibold leading-none">GHM</span>
            <span className="block text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              Property Office
            </span>
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
            <GlobalSearchTrigger />
          </span>
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
            <NotificationBell side="bottom" />
          </span>
          <Button variant="ghost" size="icon-sm" className="h-9 w-9 shrink-0" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/35 md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-[19rem] max-w-[86vw] flex-col border-r bg-popover text-popover-foreground shadow-2xl md:hidden">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setOpen(false)}>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-primary shadow-sm">
                  <span className="font-heading text-xl font-semibold leading-none">G</span>
                </span>
                <span>
                  <span className="block font-heading text-2xl font-semibold leading-none">GHM</span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                    Property Office
                  </span>
                </span>
              </Link>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="flex-1 overflow-y-auto py-3">
              <ul className="space-y-1 px-3">
                {allNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-md border-l-2 px-3 py-3 text-[0.95rem] font-medium transition-colors",
                          isActive
                            ? "border-primary bg-muted text-foreground"
                            : "border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                        )}
                      >
                        <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="space-y-1 border-t p-3">
              <ThemeToggle variant="menu" />
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-[0.95rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-5 w-5" />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
