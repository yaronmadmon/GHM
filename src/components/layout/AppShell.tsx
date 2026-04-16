"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { MigrationProvider, useMigrationContext } from "@/contexts/MigrationContext";

interface AppShellProps {
  children: React.ReactNode;
  pendingApplications?: number;
  unreadMessages?: number;
}

function ProcessingBar() {
  const { status } = useMigrationContext();
  if (status !== "processing") return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[100] h-0.5 bg-primary/20">
      <div className="h-full bg-primary animate-[shimmer_1.5s_ease-in-out_infinite] w-1/3" />
    </div>
  );
}

export function AppShell({ children, pendingApplications, unreadMessages }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <MigrationProvider>
      <ProcessingBar />
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

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-background pb-16 md:pb-0">
          {children}
        </main>

        {/* Bottom nav: mobile only */}
        <BottomNav pendingApplications={pendingApplications} />
      </div>
    </MigrationProvider>
  );
}
