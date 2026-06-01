import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BillsClient, type BillRow } from "./BillsClient";

export default async function BillsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const orgId = session.user.organizationId;

  const [bills, properties, vendors] = await Promise.all([
    prisma.bill.findMany({
      where: { organizationId: orgId },
      include: {
        vendor: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.property.findMany({
      where: { organizationId: orgId, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.vendor.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serialized: BillRow[] = bills.map((b) => ({
    id: b.id,
    vendorId: b.vendorId,
    vendorName: b.vendorName,
    propertyId: b.propertyId,
    unitId: b.unitId,
    documentId: b.documentId,
    amount: Number(b.amount),
    billDate: b.billDate?.toISOString() ?? null,
    dueDate: b.dueDate?.toISOString() ?? null,
    category: b.category,
    description: b.description,
    notes: b.notes,
    status: b.status,
    paidAt: b.paidAt?.toISOString() ?? null,
    transactionId: b.transactionId,
    createdAt: b.createdAt.toISOString(),
    vendor: b.vendor,
    property: b.property,
  }));

  return <BillsClient initialBills={serialized} properties={properties} vendors={vendors} />;
}
