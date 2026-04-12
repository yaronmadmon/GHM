import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");

    const events = await prisma.activityEvent.findMany({
      where: {
        organizationId,
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return Response.json(events);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
