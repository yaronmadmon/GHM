"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Coffee, DollarSign, MessageSquare, Users, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const items = [
  { href: "/todays-office", label: "Office", icon: Coffee },
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/rent", label: "Rent", icon: DollarSign },
  { href: "/messages", label: "Messages", icon: MessageSquare, badgeKey: "messages" },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
];

interface BottomNavProps {
  pendingApplications?: number;
  unreadMessages?: number;
}

export function BottomNav({ pendingApplications = 0, unreadMessages = 0 }: BottomNavProps) {
  const pathname = usePathname();

  const badges: Record<string, number> = {
    applications: pendingApplications,
    messages: unreadMessages,
  };

  return (
    <nav className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-card/96 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
      <div className="flex">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const badgeCount = item.badgeKey ? badges[item.badgeKey] ?? 0 : 0;
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
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 h-4 min-w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center px-0.5">
                    {badgeCount}
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
