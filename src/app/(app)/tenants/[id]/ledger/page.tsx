import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { LedgerView } from "./LedgerView";

export default async function TenantLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tenant = await prisma.tenant.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      leaseLinks: {
        include: {
          lease: {
            include: {
              unit: { include: { property: true } },
              rentPayments: { orderBy: { dueDate: "asc" } },
              transactions: { orderBy: { date: "asc" } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!tenant) notFound();

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { name: true },
  });

  const activeLease = tenant.leaseLinks.find((l) => l.lease?.status === "active")?.lease;

  return (
    <LedgerView
      tenant={tenant}
      activeLease={activeLease ?? null}
      orgName={org?.name ?? ""}
      tenantId={id}
    />
  );
}
