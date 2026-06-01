import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { InspectionsClient, type InspectionRow } from "./InspectionsClient";

export default async function InspectionsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const orgId = session.user.organizationId;

  const [inspections, properties] = await Promise.all([
    prisma.inspection.findMany({ where: { organizationId: orgId }, orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }] }),
    prisma.property.findMany({ where: { organizationId: orgId, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const serialized: InspectionRow[] = inspections.map(i => ({
    id: i.id, propertyId: i.propertyId, unitId: i.unitId, leaseId: i.leaseId, tenantId: i.tenantId,
    inspectionType: i.inspectionType, status: i.status,
    scheduledDate: i.scheduledDate?.toISOString() ?? null,
    completedDate: i.completedDate?.toISOString() ?? null,
    overallCondition: i.overallCondition, notes: i.notes, checklist: i.checklist,
    createdAt: i.createdAt.toISOString(),
  }));

  return <InspectionsClient initialInspections={serialized} properties={properties} />;
}
