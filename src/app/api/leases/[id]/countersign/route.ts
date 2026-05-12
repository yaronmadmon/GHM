import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;

    const lease = await prisma.lease.findFirst({ where: { id, organizationId }, include: { tenants: { include: { tenant: true }, where: { isPrimary: true } } } });
    if (!lease) return Response.json({ error: "Not found" }, { status: 404 });
    if (lease.signingStatus !== "tenant_signed") return Response.json({ error: "Tenant has not signed yet" }, { status: 400 });

    await prisma.lease.update({
      where: { id },
      data: { signingStatus: "fully_signed", landlordSignedAt: new Date() },
    });

    const tenant = lease.tenants[0]?.tenant;
    const documentName = `${tenant ? `${tenant.firstName}-${tenant.lastName}` : "lease"}_${new Date().toISOString().slice(0, 10)}.html`
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, "-");
    const documentUrl = `/leases/${id}/agreement`;
    const existingDocument = await prisma.leaseDocument.findFirst({
      where: { leaseId: id, url: documentUrl },
    });
    if (!existingDocument) {
      await prisma.leaseDocument.create({
        data: {
          leaseId: id,
          name: documentName,
          url: documentUrl,
          fileType: "html",
          uploadedById: undefined,
        },
      });
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
