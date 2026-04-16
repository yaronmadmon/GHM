import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function GET() {
  try {
    const { userId } = await requireOrg();
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    return Response.json({ notifications, unreadCount });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// Mark all as read
export async function PATCH() {
  try {
    const { userId } = await requireOrg();
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
