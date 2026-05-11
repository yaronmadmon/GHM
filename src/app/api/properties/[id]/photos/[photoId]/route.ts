import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id, photoId } = await params;

    const property = await prisma.property.findFirst({ where: { id, organizationId } });
    if (!property) return Response.json({ error: "Not found" }, { status: 404 });

    // Set as cover: clear existing cover first
    await prisma.propertyPhoto.updateMany({ where: { propertyId: id }, data: { isCover: false } });
    const photo = await prisma.propertyPhoto.update({ where: { id: photoId }, data: { isCover: true } });
    return Response.json(photo);
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id, photoId } = await params;

    const property = await prisma.property.findFirst({ where: { id, organizationId } });
    if (!property) return Response.json({ error: "Not found" }, { status: 404 });

    const photo = await prisma.propertyPhoto.findFirst({ where: { id: photoId, propertyId: id } });
    if (!photo) return Response.json({ error: "Not found" }, { status: 404 });

    await prisma.propertyPhoto.delete({ where: { id: photoId } });

    // If deleted photo was cover, make the next one cover
    if (photo.isCover) {
      const next = await prisma.propertyPhoto.findFirst({ where: { propertyId: id }, orderBy: { sortOrder: "asc" } });
      if (next) await prisma.propertyPhoto.update({ where: { id: next.id }, data: { isCover: true } });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
