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
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-background border-t md:hidden safe-area-bottom">
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
                "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors relative",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
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
