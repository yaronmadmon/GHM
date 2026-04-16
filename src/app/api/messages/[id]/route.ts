import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { createNotification } from "@/lib/notifications";
import { z } from "zod";

const replySchema = z.object({
  body: z.string().min(1),
  recipientId: z.string(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId } = await requireOrg();
    const { id } = await params;

    const thread = await prisma.messageThread.findFirst({
      where: {
        id,
        organizationId,
        OR: [{ landlordUserId: userId }, { tenantUserId: userId }],
      },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!thread) return Response.json({ error: "Not found" }, { status: 404 });

    // Mark all messages as read for this user
    await prisma.message.updateMany({
      where: { threadId: id, recipientId: userId, isRead: false },
      data: { isRead: true },
    });

    return Response.json(thread);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId, role } = await requireOrg();
    const { id } = await params;
    const body = await req.json();
    const data = replySchema.parse(body);

    const thread = await prisma.messageThread.findFirst({
      where: {
        id,
        organizationId,
        OR: [{ landlordUserId: userId }, { tenantUserId: userId }],
      },
    });

    if (!thread) return Response.json({ error: "Not found" }, { status: 404 });

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          organizationId,
          threadId: id,
          senderId: userId,
          senderRole: role,
          recipientId: data.recipientId,
          body: data.body,
        },
      }),
      prisma.messageThread.update({
        where: { id },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    // Notify recipient
    createNotification({
      userId: data.recipientId,
      type: "message",
      title: "New message",
      body: thread.subject,
      relatedUrl: `/messages`,
    }).catch(() => {});

    return Response.json(message, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
