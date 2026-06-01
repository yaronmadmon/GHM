import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AgentOpsClient } from "./AgentOpsClient";

export default async function AgentOpsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { organizationId } = session.user;

  const [recentRuns, pendingTasks] = await Promise.all([
    prisma.agentRun.findMany({
      where: { organizationId },
      orderBy: { startedAt: "desc" },
      take: 10,
      include: { _count: { select: { tasks: true } } },
    }),
    prisma.agentTask.findMany({
      where: { organizationId, status: "pending" },
      orderBy: { createdAt: "desc" },
      include: { run: { select: { startedAt: true, triggerEvent: true } } },
    }),
  ]);

  return (
    <AgentOpsClient
      initialRuns={recentRuns.map((r) => ({
        id: r.id,
        triggerEvent: r.triggerEvent,
        status: r.status,
        confidenceScore: r.confidenceScore,
        observationSummary: r.observationSummary,
        tasksGenerated: r.tasksGenerated,
        autoExecuted: r.autoExecuted,
        pendingApproval: r.pendingApproval,
        rawOutput: r.rawOutput as Record<string, string> | null,
        errorMessage: r.errorMessage,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
      }))}
      initialPendingTasks={pendingTasks.map((t) => ({
        id: t.id,
        actionId: t.actionId,
        riskTier: t.riskTier,
        workflow: t.workflow,
        title: t.title,
        description: t.description,
        status: t.status,
        executionPayload: t.executionPayload as Record<string, unknown> | null,
        createdAt: t.createdAt.toISOString(),
        runTrigger: t.run.triggerEvent,
        runStartedAt: t.run.startedAt.toISOString(),
      }))}
    />
  );
}
