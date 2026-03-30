import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sendLeaseSigned, APP_URL } from "@/lib/email";

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lease = await prisma.lease.findUnique({
    where: { signingToken: token },
    include: {
      unit: { include: { property: true } },
      tenants: { include: { tenant: true } },
    },
  });
  if (!lease) return Response.json({ error: "Invalid or expired signing link" }, { status: 404 });
  if (lease.signingStatus === "fully_signed") return Response.json({ error: "This lease has already been fully signed" }, { status: 410 });

  return Response.json({
    id: lease.id,
    status: lease.signingStatus,
    tenantSigned: !!lease.tenantSignedAt,
    property: lease.unit.property.name,
    unit: lease.unit.unitNumber,
    startDate: lease.startDate,
    endDate: lease.endDate,
    rentAmount: Number(lease.rentAmount),
    depositAmount: Number(lease.depositAmount ?? 0),
    tenantName: lease.tenants[0] ? `${lease.tenants[0].tenant.firstName} ${lease.tenants[0].tenant.lastName}` : "",
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const body = await req.json();
    const { signature } = z.object({ signature: z.string().min(1) }).parse(body);

    const lease = await prisma.lease.findUnique({
      where: { signingToken: token },
      include: {
        unit: { include: { property: true } },
        tenants: { include: { tenant: true }, where: { isPrimary: true } },
        organization: { include: { users: { where: { role: "owner" }, take: 1 } } },
      },
    });

    if (!lease) return Response.json({ error: "Invalid signing link" }, { status: 404 });
    if (lease.signingStatus !== "sent") return Response.json({ error: "Lease is not awaiting your signature" }, { status: 400 });

    await prisma.lease.update({
      where: { id: lease.id },
      data: { tenantSignature: signature, tenantSignedAt: new Date(), signingStatus: "tenant_signed" },
    });

    // Notify landlord
    const landlord = lease.organization.users[0];
    const tenant = lease.tenants[0]?.tenant;
    if (landlord?.email && tenant) {
      const leaseUrl = `${APP_URL}/leases`;
      await sendLeaseSigned(
        landlord.email,
        landlord.name ?? "Landlord",
        `${tenant.firstName} ${tenant.lastName}`,
        leaseUrl
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
