import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  url: z.string().url("Must be a valid URL"),
  docType: z.enum(["pay_stub", "id", "bank_statement", "other"]),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;

    const app = await prisma.application.findFirst({ where: { id, organizationId } });
    if (!app) return Response.json({ error: "Not found" }, { status: 404 });

    const docs = await prisma.applicationDocument.findMany({
      where: { applicationId: id },
      orderBy: { createdAt: "asc" },
    });

    return Response.json(docs);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId } = await requireOrg();
    const { id } = await params;
    const body = await req.json();
    const data = createSchema.parse(body);

    const app = await prisma.application.findFirst({ where: { id, organizationId } });
    if (!app) return Response.json({ error: "Not found" }, { status: 404 });

    const doc = await prisma.applicationDocument.create({
      data: { applicationId: id, ...data },
    });

    // Log activity
    await prisma.activityEvent.create({
      data: {
        organizationId,
        actorId: userId,
        entityType: "application",
        entityId: id,
        eventType: "updated",
        metadata: { action: "document_added", docType: data.docType, name: data.name },
      },
    });

    return Response.json(doc, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
