import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { ChatWidget } from "@/components/ai/ChatWidget";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const [pendingApps, unreadMsgs, openTasks, unpaidBills] = await Promise.all([
    prisma.application.count({
      where: { organizationId: session.user.organizationId, status: { in: ["pending", "documents_requested", "under_review", "screening"] } },
    }),
    prisma.message.count({
      where: { recipientId: session.user.id, isRead: false },
    }),
    prisma.task.count({
      where: { organizationId: session.user.organizationId, status: { in: ["open", "in_progress", "waiting"] } },
    }),
    prisma.bill.count({
      where: { organizationId: session.user.organizationId, status: { in: ["needs_review", "approved"] } },
    }),
  ]);

  return (
    <AppShell pendingApplications={pendingApps} unreadMessages={unreadMsgs} openTasks={openTasks} unpaidBills={unpaidBills}>
      <MobileTopBar />
      {children}
      <ChatWidget />
    </AppShell>
  );
}
