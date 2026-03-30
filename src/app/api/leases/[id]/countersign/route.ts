import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;

    const lease = await prisma.lease.findFirst({ where: { id, organizationId } });
    if (!lease) return Response.json({ error: "Not found" }, { status: 404 });
    if (lease.signingStatus !== "tenant_signed") return Response.json({ error: "Tenant has not signed yet" }, { status: 400 });

    await prisma.lease.update({
      where: { id },
      data: { signingStatus: "fully_signed", landlordSignedAt: new Date() },
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
