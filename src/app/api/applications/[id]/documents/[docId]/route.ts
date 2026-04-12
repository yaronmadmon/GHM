import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { organizationId } = await requireOrg();
    const { id, docId } = await params;

    const app = await prisma.application.findFirst({ where: { id, organizationId } });
    if (!app) return Response.json({ error: "Not found" }, { status: 404 });

    const doc = await prisma.applicationDocument.findFirst({
      where: { id: docId, applicationId: id },
    });
    if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });

    await prisma.applicationDocument.delete({ where: { id: docId } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
