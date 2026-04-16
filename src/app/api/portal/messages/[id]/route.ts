import { NextRequest } from "next/server";
import { requirePortalSession } from "@/lib/portal-session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const replySchema = z.object({ body: z.string().min(1) });

async function getThread(id: string, tenantId: string, portalUserId: string | null) {
  return prisma.messageThread.findFirst({
    where: {
      id,
      OR: [
        { tenantUserId: tenantId },
        ...(portalUserId ? [{ tenantUserId: portalUserId }] : []),
      ],
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePortalSession();
    const { id } = await params;
    const tenant = session.tenant;

    const thread = await getThread(id, tenant.id, tenant.portalUserId ?? null);
    if (!thread) return Response.json({ error: "Not found" }, { status: 404 });

    // Mark landlord messages as read
    await prisma.message.updateMany({
      where: { threadId: id, senderRole: "landlord", isRead: false },
      data: { isRead: true },
    });

    return Response.json(thread);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePortalSession();
    const { id } = await params;
    const body = await req.json();
    const { body: messageBody } = replySchema.parse(body);
    const tenant = session.tenant;

    const thread = await getThread(id, tenant.id, tenant.portalUserId ?? null);
    if (!thread) return Response.json({ error: "Not found" }, { status: 404 });

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          organizationId: thread.organizationId,
          threadId: id,
          senderId: tenant.id,
          senderRole: "tenant",
          recipientId: thread.landlordUserId,
          body: messageBody,
        },
      }),
      prisma.messageThread.update({
        where: { id },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    return Response.json(message, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
