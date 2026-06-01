import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { WorkOrdersClient, type WorkOrderRow } from "./WorkOrdersClient";

export default async function WorkOrdersPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const orgId = session.user.organizationId;

  const [workOrders, properties, vendors] = await Promise.all([
    prisma.workOrder.findMany({ where: { organizationId: orgId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    prisma.property.findMany({ where: { organizationId: orgId, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { organizationId: orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const serialized: WorkOrderRow[] = workOrders.map(w => ({
    id: w.id, title: w.title, description: w.description, status: w.status,
    estimatedCost: w.estimatedCost !== null ? Number(w.estimatedCost) : null,
    actualCost: w.actualCost !== null ? Number(w.actualCost) : null,
    vendorId: w.vendorId, propertyId: w.propertyId,
    scheduledDate: w.scheduledDate?.toISOString() ?? null,
    completedDate: w.completedDate?.toISOString() ?? null,
    transactionId: w.transactionId, notes: w.notes,
    createdAt: w.createdAt.toISOString(),
  }));

  return <WorkOrdersClient initialOrders={serialized} properties={properties} vendors={vendors} />;
}
