"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: React.ReactNode;
  pendingApplications?: number;
  unreadMessages?: number;
}

export function AppShell({ children, pendingApplications, unreadMessages }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        pendingApplications={pendingApplications}
        unreadMessages={unreadMessages}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  );
}
