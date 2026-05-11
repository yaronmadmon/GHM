import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id, photoId } = await params;

    const photo = await prisma.unitPhoto.findFirst({
      where: { id: photoId, unit: { id, property: { organizationId } } },
    });
    if (!photo) return Response.json({ error: "Not found" }, { status: 404 });

    await prisma.unitPhoto.delete({ where: { id: photoId } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }
}
