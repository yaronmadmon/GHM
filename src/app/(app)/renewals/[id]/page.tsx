import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RenewalForm } from "./RenewalForm";

export default async function RenewalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const lease = await prisma.lease.findFirst({
    where: { id, organizationId: session.user.organizationId, status: "active" },
    include: {
      unit: { include: { property: true } },
      tenants: { include: { tenant: true } },
    },
  });
  if (!lease) notFound();

  const primaryTenant = lease.tenants.find((lt) => lt.isPrimary)?.tenant ?? lease.tenants[0]?.tenant;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/renewals" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Lease Renewal</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {primaryTenant ? `${primaryTenant.firstName} ${primaryTenant.lastName}` : "Unknown tenant"} ·{" "}
            {lease.unit.property.name} · Unit {lease.unit.unitNumber}
          </p>
        </div>
      </div>

      <RenewalForm lease={{
        id: lease.id,
        rentAmount: Number(lease.rentAmount),
        startDate: lease.startDate.toISOString(),
        endDate: lease.endDate?.toISOString() ?? null,
        leaseType: lease.leaseType,
        paymentDueDay: lease.paymentDueDay,
        unit: {
          unitNumber: lease.unit.unitNumber,
          property: { name: lease.unit.property.name, address: lease.unit.property.addressLine1 },
        },
        tenants: lease.tenants.map((lt) => ({
          isPrimary: lt.isPrimary,
          tenant: {
            id: lt.tenant.id,
            firstName: lt.tenant.firstName,
            lastName: lt.tenant.lastName,
            email: lt.tenant.email,
          },
        })),
      }} />
    </div>
  );
}
