"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";

interface AppShellProps {
  children: React.ReactNode;
  pendingApplications?: number;
  unreadMessages?: number;
}

export function AppShell({ children, pendingApplications, unreadMessages }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar: hidden on mobile, visible on md+ */}
      <div className="hidden md:flex">
        <Sidebar
          pendingApplications={pendingApplications}
          unreadMessages={unreadMessages}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
      </div>

      {/* Main content: extra bottom padding on mobile for bottom nav */}
      <main className="flex-1 overflow-y-auto bg-background pb-16 md:pb-0">
        {children}
      </main>

      {/* Bottom nav: mobile only */}
      <BottomNav pendingApplications={pendingApplications} />
    </div>
  );
}
