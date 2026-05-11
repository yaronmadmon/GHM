import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { LedgerView } from "./LedgerView";

export default async function TenantLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
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

  const rawLease = tenant.leaseLinks.find((l) => l.lease?.status === "active")?.lease;

  const activeLease = rawLease ? {
    id: rawLease.id,
    startDate: rawLease.startDate,
    endDate: rawLease.endDate ?? null,
    rentAmount: Number(rawLease.rentAmount),
    depositAmount: rawLease.depositAmount != null ? Number(rawLease.depositAmount) : null,
    depositPaid: rawLease.depositPaid,
    unit: rawLease.unit,
    rentPayments: rawLease.rentPayments.map((p) => ({
      id: p.id,
      periodYear: p.periodYear,
      periodMonth: p.periodMonth,
      amountDue: Number(p.amountDue),
      amountPaid: Number(p.amountPaid),
      status: p.status,
      dueDate: p.dueDate,
      paidAt: p.paidAt ?? null,
      paymentMethod: p.paymentMethod ?? null,
      notes: p.notes ?? null,
    })),
    transactions: rawLease.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      category: t.category,
      amount: Number(t.amount),
      date: t.date,
      description: t.description ?? null,
      paymentMethod: t.paymentMethod ?? null,
    })),
  } : null;

  return (
    <LedgerView
      tenant={{ id: tenant.id, firstName: tenant.firstName, lastName: tenant.lastName, email: tenant.email, phone: tenant.phone }}
      activeLease={activeLease}
      orgName={org?.name ?? ""}
      tenantId={id}
    />
  );
}
