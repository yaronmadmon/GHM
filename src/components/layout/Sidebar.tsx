"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Wrench,
  DollarSign,
  ClipboardList,
  ArrowUpDown,
  Settings,
  LogOut,
  ChevronLeft,
  MessageSquare,
  HardHat,
  DoorOpen,
  RefreshCw,
  CalendarDays,
  FolderOpen,
  Bot,
  CheckSquare,
  Receipt,
  Coffee,
  AlertCircle,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GlobalSearch } from "@/components/GlobalSearch";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badgeKey?: string;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    items: [
      { href: "/todays-office", label: "Today's Office", icon: Coffee },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/properties", label: "Properties", icon: Building2 },
      { href: "/tenants", label: "Tenants", icon: Users },
    ],
  },
  {
    label: "Leasing",
    items: [
      { href: "/vacancy", label: "Vacancy", icon: DoorOpen },
      { href: "/applications", label: "Applications", icon: ClipboardList, badgeKey: "applications" },
      { href: "/leases", label: "Leases", icon: FileText },
      { href: "/renewals", label: "Renewals", icon: RefreshCw },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/rent", label: "Rent", icon: DollarSign },
      { href: "/maintenance", label: "Maintenance", icon: Wrench },
      { href: "/vendors", label: "Vendors", icon: HardHat },
      { href: "/messages", label: "Messages", icon: MessageSquare, badgeKey: "messages" },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/tasks", label: "Tasks", icon: CheckSquare, badgeKey: "tasks" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/financials", label: "Financials", icon: ArrowUpDown },
      { href: "/bills", label: "Bills", icon: Receipt, badgeKey: "bills" },
      { href: "/documents", label: "Documents", icon: FolderOpen },
      { href: "/missing-documents", label: "Missing Docs", icon: AlertCircle, badgeKey: "missingDocs" },
      { href: "/import-export", label: "Import / Export", icon: ArrowUpDown },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/agent", label: "Agent Ops", icon: Bot },
    ],
  },
  {
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  pendingApplications?: number;
  unreadMessages?: number;
  openTasks?: number;
  unpaidBills?: number;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ pendingApplications = 0, unreadMessages = 0, openTasks = 0, unpaidBills = 0, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  const badges: Record<string, number> = {
    applications: pendingApplications,
    messages: unreadMessages,
    tasks: openTasks,
    bills: unpaidBills,
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar/95 shadow-sm transition-all duration-200",
        collapsed ? "w-[4.25rem]" : "w-64"
      )}
    >
      <div className={cn("relative flex h-16 items-center gap-2 border-b border-sidebar-border px-3", collapsed ? "justify-center" : "justify-between")}>
        <Link href="/dashboard" className={cn("flex min-w-0 items-center gap-3", collapsed && "justify-center")}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sidebar-border bg-card text-primary shadow-sm">
            <span className="font-heading text-xl font-semibold leading-none">G</span>
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block font-heading text-2xl font-semibold leading-none text-sidebar-foreground">GHM</span>
              <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
                Property Office
              </span>
            </span>
          )}
        </Link>
        <button
          onClick={onToggle}
          className={cn(
            "rounded-md p-1.5 text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "absolute -right-3 top-1/2 -translate-y-1/2 border bg-card shadow-sm"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      <div className={cn("border-b border-sidebar-border px-2 py-2.5", collapsed && "px-1.5")}>
        <GlobalSearch collapsed={collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-1 px-2">
          {navSections.map((section, si) => (
            <li key={si}>
              {section.label && !collapsed && (
                <p className="px-2.5 pb-1.5 pt-4 text-xs font-semibold uppercase tracking-[0.13em] text-sidebar-foreground/42 select-none">
                  {section.label}
                </p>
              )}
              {section.label && collapsed && si > 0 && (
                <div className="mx-2 my-2 border-t border-sidebar-border/70" />
              )}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-[0.95rem] font-medium transition-colors",
                          isActive
                            ? "border-sidebar-primary bg-sidebar-accent text-sidebar-foreground shadow-sm"
                            : "border-transparent text-sidebar-foreground/68 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                          collapsed && "justify-center px-2"
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/55")} />
                        {!collapsed && (
                          <>
                            <span className="flex-1">{item.label}</span>
                            {badgeCount > 0 && (
                              <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">
                                {badgeCount}
                              </Badge>
                            )}
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-2">
        <div className={cn("flex", collapsed ? "justify-center" : "px-1")}>
          <NotificationBell collapsed={collapsed} />
        </div>
        <ThemeToggle collapsed={collapsed} />
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full text-sidebar-foreground/68 hover:bg-sidebar-accent hover:text-sidebar-foreground", collapsed ? "justify-center px-2" : "justify-start gap-3")}
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </Button>
      </div>
    </aside>
  );
}
