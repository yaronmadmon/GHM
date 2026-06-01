import { NextRequest } from "next/server";
import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;

    const tasks = await prisma.agentTask.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        run: { select: { triggerEvent: true, startedAt: true } },
        approvedBy: { select: { name: true, email: true } },
      },
    });

    return Response.json(
      tasks.map((t) => ({
        id: t.id,
        actionId: t.actionId,
        riskTier: t.riskTier,
        workflow: t.workflow,
        title: t.title,
        description: t.description,
        status: t.status,
        executionPayload: t.executionPayload,
        result: t.result,
        approvedBy: t.approvedBy ? { name: t.approvedBy.name, email: t.approvedBy.email } : null,
        approvedAt: t.approvedAt?.toISOString() ?? null,
        executedAt: t.executedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        runTrigger: t.run.triggerEvent,
        runStartedAt: t.run.startedAt.toISOString(),
      })),
    );
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
