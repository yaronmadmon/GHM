import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TasksClient, type TaskRow } from "./TasksClient";

export default async function TasksPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const tasks = await prisma.task.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  const serialized: TaskRow[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    relatedType: t.relatedType,
    relatedId: t.relatedId,
    tenantId: t.tenantId,
    propertyId: t.propertyId,
    createdByAI: t.createdByAI,
    createdAt: t.createdAt.toISOString(),
  }));

  return <TasksClient initialTasks={serialized} />;
}
