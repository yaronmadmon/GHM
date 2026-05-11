import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { sendNonRenewalNotice } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const notes: string | undefined = body.notes;

    const lease = await prisma.lease.findFirst({
      where: { id, organizationId },
      include: {
        unit: { include: { property: true } },
        tenants: { include: { tenant: true }, where: { isPrimary: true } },
      },
    });
    if (!lease) return Response.json({ error: "Lease not found" }, { status: 404 });

    const tenant = lease.tenants[0]?.tenant;
    if (!tenant?.email) return Response.json({ error: "Primary tenant has no email address" }, { status: 400 });

    await sendNonRenewalNotice(
      tenant.email,
      `${tenant.firstName} ${tenant.lastName}`,
      lease.unit.property.name,
      lease.endDate ?? new Date(),
      notes,
    );

    return Response.json({ success: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
