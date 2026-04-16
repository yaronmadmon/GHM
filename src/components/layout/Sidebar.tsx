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
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "./NotificationBell";

interface SidebarProps {
  pendingApplications?: number;
  unreadMessages?: number;
  collapsed?: boolean;
  onToggle?: () => void;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/leases", label: "Leases", icon: FileText },
  { href: "/rent", label: "Rent", icon: DollarSign },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/vendors", label: "Vendors", icon: HardHat },
  { href: "/financials", label: "Financials", icon: ArrowUpDown },
  { href: "/applications", label: "Applications", icon: ClipboardList, badgeKey: "applications" },
  { href: "/messages", label: "Messages", icon: MessageSquare, badgeKey: "messages" },
  { href: "/import-export", label: "Import / Export", icon: ArrowUpDown },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ pendingApplications = 0, unreadMessages = 0, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  const badges: Record<string, number> = {
    applications: pendingApplications,
    messages: unreadMessages,
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center h-14 px-4 border-b border-sidebar-border", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sidebar-foreground tracking-tight">GHM</span>
          </Link>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {badgeCount > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 text-xs px-1">
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
      </nav>

      {/* Notification bell + Sign out */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        <div className={cn("flex", collapsed ? "justify-center" : "px-1")}>
          <NotificationBell collapsed={collapsed} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent", collapsed ? "px-2 justify-center" : "justify-start gap-3")}
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </Button>
      </div>
    </aside>
  );
}
