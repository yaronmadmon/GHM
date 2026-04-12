import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const ALL_STATUSES = ["pending", "documents_requested", "under_review", "screening", "approved", "denied"] as const;

const updateSchema = z.object({
  status: z.enum(ALL_STATUSES).optional(),
  backgroundCheckStatus: z.enum(["not_started", "in_progress", "passed", "failed", "conditional"]).nullable().optional(),
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

    // Guard: "approved" status must come from the /convert endpoint
    if (data.status === "approved") {
      return Response.json({ error: "Use the convert endpoint to approve an application" }, { status: 400 });
    }

    const { backgroundCheckDate, ...rest } = data;
    const statusChanged = data.status && data.status !== existing.status;
    const screeningChanged = data.backgroundCheckStatus && data.backgroundCheckStatus !== existing.backgroundCheckStatus;

    const app = await prisma.application.update({
      where: { id },
      data: {
        ...rest,
        ...(backgroundCheckDate !== undefined ? { backgroundCheckDate: backgroundCheckDate ? new Date(backgroundCheckDate) : null } : {}),
        ...(statusChanged ? { reviewedById: userId, reviewedAt: new Date() } : {}),
      },
    });

    // Log activity for status changes
    if (statusChanged) {
      await prisma.activityEvent.create({
        data: {
          organizationId,
          actorId: userId,
          entityType: "application",
          entityId: id,
          eventType: "status_changed",
          metadata: { from: existing.status, to: data.status },
        },
      });
    }

    // Log activity for screening updates
    if (screeningChanged) {
      await prisma.activityEvent.create({
        data: {
          organizationId,
          actorId: userId,
          entityType: "application",
          entityId: id,
          eventType: "updated",
          metadata: { field: "backgroundCheckStatus", from: existing.backgroundCheckStatus, to: data.backgroundCheckStatus },
        },
      });
    }

    return Response.json(app);
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
