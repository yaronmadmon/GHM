import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { sendLeaseForSigning, APP_URL } from "@/lib/email";
import crypto from "crypto";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;

    const lease = await prisma.lease.findFirst({
      where: { id, organizationId },
      include: {
        unit: { include: { property: true } },
        tenants: { include: { tenant: true }, where: { isPrimary: true } },
      },
    });
    if (!lease) return Response.json({ error: "Not found" }, { status: 404 });

    const tenant = lease.tenants[0]?.tenant;
    if (!tenant?.email) return Response.json({ error: "Tenant has no email address" }, { status: 400 });

    const token = crypto.randomBytes(32).toString("hex");
    await prisma.lease.update({
      where: { id },
      data: { signingToken: token, signingStatus: "sent" },
    });

    const signUrl = `${APP_URL}/lease-sign/${token}`;
    await sendLeaseForSigning(tenant.email, `${tenant.firstName} ${tenant.lastName}`, signUrl, lease.unit.property.name);

    return Response.json({ success: true, signUrl });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
