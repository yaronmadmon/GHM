import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const createThreadSchema = z.object({
  subject: z.string().min(1),
  tenantUserId: z.string(),
  leaseId: z.string().optional(),
  body: z.string().min(1),
});

export async function GET() {
  try {
    const { organizationId, userId } = await requireOrg();
    const threads = await prisma.messageThread.findMany({
      where: {
        organizationId,
        OR: [{ landlordUserId: userId }, { tenantUserId: userId }],
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: "desc" },
    });
    return Response.json(threads);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const body = await req.json();
    const data = createThreadSchema.parse(body);

    const thread = await prisma.$transaction(async (tx) => {
      const t = await tx.messageThread.create({
        data: {
          organizationId,
          subject: data.subject,
          landlordUserId: userId,
          tenantUserId: data.tenantUserId,
          leaseId: data.leaseId,
          lastMessageAt: new Date(),
        },
      });
      await tx.message.create({
        data: {
          organizationId,
          threadId: t.id,
          senderId: userId,
          senderRole: "landlord",
          recipientId: data.tenantUserId,
          body: data.body,
        },
      });
      return t;
    });

    return Response.json(thread, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
