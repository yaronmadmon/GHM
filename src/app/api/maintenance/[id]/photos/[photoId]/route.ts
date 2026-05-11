import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id, photoId } = await params;

    const request = await prisma.maintenanceRequest.findFirst({ where: { id, organizationId } });
    if (!request) return Response.json({ error: "Not found" }, { status: 404 });

    await prisma.maintenancePhoto.deleteMany({ where: { id: photoId, requestId: id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
