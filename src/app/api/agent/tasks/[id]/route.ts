import { NextRequest } from "next/server";
import { requireOrg } from "@/lib/session";
import { approveAndExecuteTask } from "@/lib/agent/portfolio-agent";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { organizationId, userId } = await requireOrg();
    const { id } = await params;
    const body = await req.json() as { action: "approve" | "reject" };

    if (body.action === "approve") {
      const result = await approveAndExecuteTask(id, organizationId, userId);
      if (!result.success) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      return Response.json({ success: true });
    }

    if (body.action === "reject") {
      const task = await prisma.agentTask.findFirst({
        where: { id, organizationId, status: "pending" },
      });
      if (!task) return Response.json({ error: "Task not found or not pending" }, { status: 404 });
      await prisma.agentTask.update({
        where: { id },
        data: { status: "rejected", approvedById: userId, approvedAt: new Date() },
      });
      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
