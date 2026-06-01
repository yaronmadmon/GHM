import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { organizationId } = await requireOrg();
    const runs = await prisma.agentRun.findMany({
      where: { organizationId },
      orderBy: { startedAt: "desc" },
      take: 20,
      include: { _count: { select: { tasks: true } } },
    });

    return Response.json(
      runs.map((r) => ({
        id: r.id,
        triggerEvent: r.triggerEvent,
        status: r.status,
        confidenceScore: r.confidenceScore,
        observationSummary: r.observationSummary,
        tasksGenerated: r.tasksGenerated,
        autoExecuted: r.autoExecuted,
        pendingApproval: r.pendingApproval,
        rawOutput: r.rawOutput,
        errorMessage: r.errorMessage,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
      })),
    );
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
