import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { ChatWidget } from "@/components/ai/ChatWidget";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [pendingApps, unreadMsgs] = await Promise.all([
    prisma.application.count({
      where: { organizationId: session.user.organizationId, status: "pending" },
    }),
    prisma.message.count({
      where: { recipientId: session.user.id, isRead: false },
    }),
  ]);

  return (
    <AppShell pendingApplications={pendingApps} unreadMessages={unreadMsgs}>
      <MobileTopBar />
      {children}
      <ChatWidget />
    </AppShell>
  );
}
