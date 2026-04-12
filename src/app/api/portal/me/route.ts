import { requirePortalSession } from "@/lib/portal-session";

export async function GET() {
  try {
    const session = await requirePortalSession();
    const tenant = session.tenant;
    const lease = tenant.leaseLinks[0]?.lease ?? null;

    return Response.json({
      tenant: {
        id: tenant.id,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        email: tenant.email,
        phone: tenant.phone,
      },
      lease: lease
        ? {
            id: lease.id,
            startDate: lease.startDate,
            endDate: lease.endDate,
            rentAmount: Number(lease.rentAmount),
            depositAmount: Number(lease.depositAmount ?? 0),
            status: lease.status,
            signingStatus: lease.signingStatus,
            unit: {
              unitNumber: lease.unit.unitNumber,
              property: {
                name: lease.unit.property.name,
                addressLine1: lease.unit.property.addressLine1,
                city: lease.unit.property.city,
                state: lease.unit.property.state,
              },
            },
            nextPayment: lease.rentPayments[0] ?? null,
            documents: lease.documents,
          }
        : null,
    });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
