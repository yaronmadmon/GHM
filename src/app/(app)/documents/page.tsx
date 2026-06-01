import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DocumentCenterClient } from "./DocumentCenterClient";

export default async function DocumentsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const organizationId = session.user.organizationId;

  const [documents, properties] = await Promise.all([
    prisma.propertyDocument.findMany({
      where: { organizationId },
      include: { property: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.property.findMany({
      where: { organizationId, archivedAt: null },
      select: { id: true, name: true, addressLine1: true, city: true, state: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedDocs = documents.map((d) => ({
    id: d.id,
    organizationId: d.organizationId,
    propertyId: d.propertyId,
    documentType: d.documentType,
    vendor: d.vendor,
    amount: d.amount !== null ? Number(d.amount) : null,
    issueDate: d.issueDate?.toISOString() ?? null,
    dueDate: d.dueDate?.toISOString() ?? null,
    fileUrl: d.fileUrl,
    fileKey: d.fileKey,
    fileName: d.fileName,
    confidenceScore: d.confidenceScore,
    aiEstimated: d.aiEstimated,
    notes: d.notes,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    property: d.property,
  }));

  const serializedProperties = properties.map((p) => ({
    id: p.id,
    name: p.name,
    address: `${p.addressLine1}, ${p.city}, ${p.state}`,
  }));

  return (
    <DocumentCenterClient
      initialDocuments={serializedDocs}
      properties={serializedProperties}
    />
  );
}
