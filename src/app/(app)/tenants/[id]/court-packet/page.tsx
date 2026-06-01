import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { calculateLeaseOutstandingBalance } from "@/lib/rent-ledger";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CourtPacketPrintButton } from "./CourtPacketPrintButton";

export default async function CourtPacketPage({ params }: { params: Promise<{ id: string }> }) {
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
              tenants: { include: { tenant: true } },
              rentPayments: { orderBy: { dueDate: "asc" } },
              transactions: { orderBy: { date: "asc" } },
              documents: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      convertedFrom: {
        include: { documents: { orderBy: { createdAt: "desc" } } },
      },
    },
  });

  if (!tenant) notFound();

  const activeLease = tenant.leaseLinks.find((l) => l.lease?.status === "active")?.lease;
  const allLeases = tenant.leaseLinks.map((l) => l.lease).filter(Boolean);

  const activityEvents = await prisma.activityEvent.findMany({
    where: {
      organizationId: session.user.organizationId,
      OR: [
        { entityType: "tenant", entityId: id },
        ...tenant.leaseLinks.map((l) => ({ entityType: "lease", entityId: l.leaseId })),
      ],
    },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const maintenanceRequests = await prisma.maintenanceRequest.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...(activeLease ? { unit: { leases: { some: { id: activeLease.id } } } } : { reportedByTenantId: id }),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const balance = activeLease
    ? calculateLeaseOutstandingBalance({
        rentPayments: activeLease.rentPayments,
        transactions: activeLease.transactions,
      })
    : 0;

  const tenantName = `${tenant.firstName} ${tenant.lastName}`;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const noticeEvents = activityEvents.filter((e) => e.eventType === "notice_sent");

  return (
    <>
      {/* Screen-only nav */}
      <div className="court-packet-nav p-4 flex items-center gap-3 print:hidden">
        <Link href={`/tenants/${id}`}>
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Tenant
          </Button>
        </Link>
        <CourtPacketPrintButton />
      </div>

      {/* Printable document */}
      <div className="court-packet-doc mx-auto max-w-3xl px-8 py-6 text-sm print:p-0 print:max-w-none">
        {/* Header */}
        <div className="mb-8 border-b pb-6 print:mb-6">
          <h1 className="text-2xl font-bold">Court Packet</h1>
          <p className="text-muted-foreground mt-1">Prepared {today}</p>
          <p className="mt-3 text-xs text-muted-foreground print:text-gray-500">
            This document contains confidential property management records. For court or legal use only.
          </p>
        </div>

        {/* Section 1: Tenant */}
        <section className="mb-8">
          <h2 className="mb-3 border-b pb-1 text-base font-semibold uppercase tracking-wide">1. Tenant Information</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground print:text-gray-500">Name:</span> {tenantName}</div>
            <div><span className="text-muted-foreground print:text-gray-500">Email:</span> {tenant.email ?? "—"}</div>
            <div><span className="text-muted-foreground print:text-gray-500">Phone:</span> {tenant.phone ?? "—"}</div>
            {activeLease && (
              <div className="col-span-2">
                <span className="text-muted-foreground print:text-gray-500">Unit:</span>{" "}
                {activeLease.unit.property.name} — Unit {activeLease.unit.unitNumber},{" "}
                {activeLease.unit.property.addressLine1}, {activeLease.unit.property.city},{" "}
                {activeLease.unit.property.state} {activeLease.unit.property.zip}
              </div>
            )}
          </div>
        </section>

        {/* Section 2: Lease */}
        {activeLease && (
          <section className="mb-8">
            <h2 className="mb-3 border-b pb-1 text-base font-semibold uppercase tracking-wide">2. Lease Summary</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground print:text-gray-500">Lease start:</span> {formatDate(activeLease.startDate)}</div>
              <div><span className="text-muted-foreground print:text-gray-500">Lease end:</span> {activeLease.endDate ? formatDate(activeLease.endDate) : "Month-to-month"}</div>
              <div><span className="text-muted-foreground print:text-gray-500">Monthly rent:</span> {formatCurrency(Number(activeLease.rentAmount))}</div>
              <div><span className="text-muted-foreground print:text-gray-500">Deposit:</span> {formatCurrency(Number(activeLease.depositAmount ?? 0))}</div>
              <div><span className="text-muted-foreground print:text-gray-500">Signing status:</span> {activeLease.signingStatus.replace(/_/g, " ")}</div>
              <div>
                <span className="text-muted-foreground print:text-gray-500">Outstanding balance:</span>{" "}
                <strong className={balance > 0 ? "text-destructive print:text-red-700" : "text-emerald-700"}>
                  {formatCurrency(balance)}
                </strong>
              </div>
            </div>
          </section>
        )}

        {/* Section 3: Payment History */}
        {activeLease && activeLease.rentPayments.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 border-b pb-1 text-base font-semibold uppercase tracking-wide">3. Rent Payment History</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground print:text-gray-500">
                  <th className="py-1.5 pr-4">Period</th>
                  <th className="py-1.5 pr-4">Due Date</th>
                  <th className="py-1.5 pr-4">Amount Due</th>
                  <th className="py-1.5 pr-4">Amount Paid</th>
                  <th className="py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {activeLease.rentPayments.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-1.5 pr-4">{`${p.periodYear}-${String(p.periodMonth).padStart(2, "0")}`}</td>
                    <td className="py-1.5 pr-4">{formatDate(p.dueDate)}</td>
                    <td className="py-1.5 pr-4 font-mono">{formatCurrency(Number(p.amountDue))}</td>
                    <td className="py-1.5 pr-4 font-mono">{formatCurrency(Number(p.amountPaid))}</td>
                    <td className={`py-1.5 font-medium ${p.status === "overdue" ? "text-destructive print:text-red-700" : p.status === "paid" ? "text-emerald-700" : ""}`}>
                      {p.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Section 4: Tenant Charges */}
        {activeLease && (() => {
          const charges = activeLease.transactions.filter((t) => t.category !== "rent");
          if (!charges.length) return null;
          return (
            <section className="mb-8">
              <h2 className="mb-3 border-b pb-1 text-base font-semibold uppercase tracking-wide">4. Tenant Charges & Credits</h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground print:text-gray-500">
                    <th className="py-1.5 pr-4">Date</th>
                    <th className="py-1.5 pr-4">Description</th>
                    <th className="py-1.5 pr-4">Category</th>
                    <th className="py-1.5">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((t) => (
                    <tr key={t.id} className="border-b">
                      <td className="py-1.5 pr-4">{formatDate(t.date)}</td>
                      <td className="py-1.5 pr-4">{t.description ?? "—"}</td>
                      <td className="py-1.5 pr-4 capitalize">{t.category.replace(/_/g, " ")}</td>
                      <td className={`py-1.5 font-mono font-medium ${t.type === "income" ? "text-destructive print:text-red-700" : "text-emerald-700"}`}>
                        {t.type === "expense" ? "−" : "+"}{formatCurrency(Number(t.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })()}

        {/* Section 5: Notices Sent */}
        {noticeEvents.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 border-b pb-1 text-base font-semibold uppercase tracking-wide">5. Notices Sent</h2>
            <div className="space-y-4 text-sm">
              {noticeEvents.map((e) => {
                const meta = e.metadata as Record<string, string> | null;
                return (
                  <div key={e.id} className="rounded border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{meta?.noticeLabel ?? "Notice"}</span>
                      <span className="text-muted-foreground print:text-gray-500 text-xs">{formatDate(e.createdAt)}</span>
                    </div>
                    <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground print:text-gray-600">
                      {meta?.noticeText ?? ""}
                    </pre>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Section 6: Maintenance */}
        {maintenanceRequests.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 border-b pb-1 text-base font-semibold uppercase tracking-wide">6. Maintenance Records</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground print:text-gray-500">
                  <th className="py-1.5 pr-4">Date</th>
                  <th className="py-1.5 pr-4">Title</th>
                  <th className="py-1.5 pr-4">Priority</th>
                  <th className="py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceRequests.map((m) => (
                  <tr key={m.id} className="border-b">
                    <td className="py-1.5 pr-4">{formatDate(m.createdAt)}</td>
                    <td className="py-1.5 pr-4">{m.title}</td>
                    <td className="py-1.5 pr-4 capitalize">{m.priority}</td>
                    <td className="py-1.5 capitalize">{m.status.replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Section 7: Activity Timeline */}
        {activityEvents.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 border-b pb-1 text-base font-semibold uppercase tracking-wide">7. Activity Timeline</h2>
            <div className="space-y-1.5 text-sm">
              {activityEvents.map((e) => (
                <div key={e.id} className="flex gap-4 border-b py-1.5 last:border-0">
                  <span className="w-32 shrink-0 text-muted-foreground print:text-gray-500">{formatDate(e.createdAt)}</span>
                  <span className="capitalize">{e.eventType.replace(/_/g, " ")} ({e.entityType})</span>
                  {e.actor?.name && <span className="text-muted-foreground print:text-gray-500">— {e.actor.name}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="border-t pt-4 mt-8 text-xs text-muted-foreground print:text-gray-500">
          <p>Prepared by GHM Property Management · {today}</p>
          <p className="mt-1">Tenant: {tenantName} · {tenant.email ?? "no email"}</p>
        </div>
      </div>
    </>
  );
}
