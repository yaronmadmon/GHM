import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

// Mark single notification as read
export async function PATCH(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireOrg();
    const { id } = await params;
    await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
