import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { buildDefaultLeaseTemplate } from "@/lib/default-lease-template";
import { formatCurrency, formatDate } from "@/lib/utils";

type Occupant = { name?: string };

function parseOccupants(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => item && typeof item === "object" ? (item as Occupant).name : null)
    .filter((name): name is string => Boolean(name));
}

export default async function LeaseAgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const lease = await prisma.lease.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      unit: { include: { property: true } },
      tenants: { include: { tenant: true }, orderBy: { createdAt: "asc" } },
      convertedFrom: true,
    },
  });

  if (!lease) notFound();

  const residents = lease.tenants.map((link) => `${link.tenant.firstName} ${link.tenant.lastName}`);
  const property = lease.unit.property;
  const propertyAddress = `${property.addressLine1}, ${property.city}, ${property.state} ${property.zip}`;
  const sections = buildDefaultLeaseTemplate({
    landlordName: "Green Hill Management Corp",
    landlordAddress: "1567 E 10th St, Brooklyn, NY 11230",
    landlordPhone: "(718) 664-4026",
    residents,
    occupants: parseOccupants(lease.convertedFrom?.additionalOccupants),
    propertyAddress,
    leaseStart: lease.startDate,
    leaseEnd: lease.endDate,
    monthlyRent: Number(lease.rentAmount),
    proratedRent: Number(lease.rentAmount),
    securityDeposit: Number(lease.depositAmount ?? 0),
    lateFeeAmount: Number(lease.lateFeeAmount ?? 75),
    returnedPaymentFee: 50,
  });

  return (
    <div className="bg-muted/20 print:bg-white">
      <div className="sticky top-0 z-10 border-b bg-background px-4 py-3 print:hidden">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Link href={`/leases/${id}`}>
            <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>
          </Link>
          <p className="flex-1 text-sm font-medium">Lease Agreement</p>
          <p className="text-xs text-muted-foreground">Use browser print to save as PDF</p>
        </div>
      </div>

      <main className="mx-auto max-w-4xl bg-white px-8 py-10 text-black shadow-sm print:max-w-none print:shadow-none">
        <header className="mb-8 border-b pb-6">
          <h1 className="text-2xl font-bold">Green Hill Management Corp</h1>
          <p className="text-sm text-neutral-600">1567 E 10th St, Brooklyn, NY 11230</p>
          <p className="text-sm text-neutral-600">(718) 664-4026</p>
          <h2 className="mt-5 text-xl font-semibold">Residential Lease Agreement</h2>
        </header>

        <section className="mb-8 grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm">
          <div><p className="text-neutral-500">Residents</p><p className="font-medium">{residents.join(", ")}</p></div>
          <div><p className="text-neutral-500">Property</p><p className="font-medium">{property.name} - Unit {lease.unit.unitNumber}</p></div>
          <div className="col-span-2"><p className="text-neutral-500">Address</p><p className="font-medium">{propertyAddress}</p></div>
          <div><p className="text-neutral-500">Lease From</p><p className="font-medium">{formatDate(lease.startDate)}</p></div>
          <div><p className="text-neutral-500">Lease To</p><p className="font-medium">{lease.endDate ? formatDate(lease.endDate) : "Month-to-month"}</p></div>
          <div><p className="text-neutral-500">Monthly Rent</p><p className="font-medium">{formatCurrency(Number(lease.rentAmount))}</p></div>
          <div><p className="text-neutral-500">Security Deposit</p><p className="font-medium">{formatCurrency(Number(lease.depositAmount ?? 0))}</p></div>
        </section>

        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h3 className="mb-3 text-lg font-semibold">{section.title}</h3>
              <div className="space-y-3 text-sm leading-7 text-neutral-800">
                {section.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              </div>
              {section.initials && (
                <div className="mt-4 border-t pt-3 text-sm text-neutral-600">
                  Resident initials: ____________  ____________
                </div>
              )}
            </section>
          ))}
        </div>

        <section className="mt-12 grid grid-cols-2 gap-8 border-t pt-6 text-sm">
          <div>
            <p className="font-medium">Resident Signature</p>
            <p className="mt-6 border-b pb-1 font-serif text-lg">{lease.tenantSignature ?? ""}</p>
            <p className="mt-1 text-neutral-500">{lease.tenantSignedAt ? formatDate(lease.tenantSignedAt) : "Not signed"}</p>
          </div>
          <div>
            <p className="font-medium">Owner/Agent Signature</p>
            <p className="mt-6 border-b pb-1 font-serif text-lg">{lease.landlordSignedAt ? "Yaron Madmon" : ""}</p>
            <p className="mt-1 text-neutral-500">{lease.landlordSignedAt ? formatDate(lease.landlordSignedAt) : "Not signed"}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
