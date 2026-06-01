"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Building2, DollarSign, Wrench, ClipboardList } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/rent", label: "Rent", icon: DollarSign },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/applications", label: "Applications", icon: ClipboardList },
];

export function BottomNav({ pendingApplications = 0 }: { pendingApplications?: number }) {
  const pathname = usePathname();
  return (
    <nav className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-card/96 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
      <div className="flex">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const badge = item.href === "/applications" && pendingApplications > 0 ? pendingApplications : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
              <span className="relative">
                <Icon className="h-5 w-5" />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 h-4 min-w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center px-0.5">
                    {badge}
                  </span>
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
