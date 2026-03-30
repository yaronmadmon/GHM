import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["pending", "approved", "denied"]).optional(),
  backgroundCheckStatus: z.string().nullable().optional(),
  backgroundCheckNotes: z.string().nullable().optional(),
  backgroundCheckDate: z.string().nullable().optional(),
  decisionNotes: z.string().nullable().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;

    const app = await prisma.application.findFirst({
      where: { id, organizationId },
      include: {
        property: true,
        unit: true,
        references: true,
        documents: true,
        reviewedBy: { select: { name: true } },
      },
    });

    if (!app) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(app);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId } = await requireOrg();
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.application.findFirst({ where: { id, organizationId } });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    const { backgroundCheckDate, ...rest } = data;
    const app = await prisma.application.update({
      where: { id },
      data: {
        ...rest,
        ...(backgroundCheckDate !== undefined ? { backgroundCheckDate: backgroundCheckDate ? new Date(backgroundCheckDate) : null } : {}),
        ...(data.status && data.status !== existing.status ? { reviewedById: userId, reviewedAt: new Date() } : {}),
      },
    });

    return Response.json(app);
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
