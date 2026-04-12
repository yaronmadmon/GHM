import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId } = await requireOrg();
    const { id } = await params;

    const lease = await prisma.lease.findFirst({ where: { id, organizationId } });
    if (!lease) return Response.json({ error: "Not found" }, { status: 404 });
    if (lease.signingStatus !== "fully_signed") {
      return Response.json({ error: "Lease must be fully signed before confirming move-in" }, { status: 400 });
    }
    if (lease.moveInCompleted) {
      return Response.json({ error: "Move-in already confirmed" }, { status: 400 });
    }

    const updated = await prisma.lease.update({
      where: { id },
      data: { moveInCompleted: true, moveInCompletedAt: new Date() },
    });

    await prisma.activityEvent.create({
      data: {
        organizationId,
        actorId: userId,
        entityType: "lease",
        entityId: id,
        eventType: "status_changed",
        metadata: { action: "move_in_confirmed" },
      },
    });

    return Response.json(updated);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
