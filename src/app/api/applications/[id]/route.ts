import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";
import {
  APPLICATION_DOCUMENT_LABELS,
  APPLICATION_DOCUMENT_TYPES,
  APPLICATION_STATUSES,
  validateApplicationStatusTransition,
} from "@/lib/application-workflow";
import { sendApplicationDocumentRequest, APP_URL } from "@/lib/email";

const updateSchema = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
  backgroundCheckStatus: z.enum(["not_started", "in_progress", "passed", "failed", "conditional"]).nullable().optional(),
  backgroundCheckNotes: z.string().nullable().optional(),
  backgroundCheckDate: z.string().nullable().optional(),
  decisionNotes: z.string().nullable().optional(),
  requestedDocumentTypes: z.array(z.enum(APPLICATION_DOCUMENT_TYPES)).optional(),
  documentRequestMessage: z.string().nullable().optional(),
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
        convertedTenant: true,
        convertedLease: {
          select: {
            id: true,
            signingStatus: true,
            signingToken: true,
            tenantSignedAt: true,
            landlordSignedAt: true,
            moveInCompleted: true,
            moveInCompletedAt: true,
          },
        },
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

    const existing = await prisma.application.findFirst({
      where: { id, organizationId },
      include: { documents: true, invite: true, property: true, unit: true },
    });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    const requestedDocumentTypes = Array.from(new Set(data.requestedDocumentTypes ?? []));
    const requestingDocuments = data.status === "documents_requested" || requestedDocumentTypes.length > 0 || data.documentRequestMessage !== undefined;
    if (requestingDocuments && requestedDocumentTypes.length === 0) {
      return Response.json({ error: "Select at least one document to request." }, { status: 400 });
    }
    if (requestingDocuments && !existing.invite?.token) {
      return Response.json({ error: "This application does not have an applicant upload link." }, { status: 400 });
    }

    if (data.status) {
      const validation = validateApplicationStatusTransition(existing, data.status);
      if (!validation.ok) {
        return Response.json({ error: "Invalid application status transition", blockers: validation.blockers }, { status: 400 });
      }
    }

    const { backgroundCheckDate, requestedDocumentTypes: _requestedDocumentTypes, documentRequestMessage, ...rest } = data;
    const statusChanged = data.status && data.status !== existing.status;
    const screeningChanged = data.backgroundCheckStatus && data.backgroundCheckStatus !== existing.backgroundCheckStatus;
    const requestMessage = documentRequestMessage?.trim() || null;

    const app = await prisma.application.update({
      where: { id },
      data: {
        ...rest,
        ...(requestingDocuments && requestMessage !== null ? { decisionNotes: requestMessage } : {}),
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

    let documentRequest: { emailSent: boolean; emailError: string | null; applyUrl: string; requestedLabels: string[] } | null = null;
    if (requestingDocuments) {
      const applyUrl = `${APP_URL}/apply/${existing.invite!.token}`;
      const applicantName = `${existing.firstName} ${existing.lastName}`.trim();
      const propertyName = existing.property?.name ?? "the property";
      const requestedLabels = requestedDocumentTypes.map((type) => APPLICATION_DOCUMENT_LABELS[type] ?? type);
      let emailSent = false;
      let emailError: string | null = null;

      if (existing.email) {
        try {
          await sendApplicationDocumentRequest({
            to: existing.email,
            applicantName,
            propertyName,
            applyUrl,
            requestedLabels,
            message: requestMessage,
          });
          emailSent = true;
        } catch (error) {
          emailError = error instanceof Error ? error.message : "Failed to send email";
          console.error("Failed to send application document request email:", error);
        }
      } else {
        emailError = "Applicant email is missing";
      }

      await prisma.activityEvent.create({
        data: {
          organizationId,
          actorId: userId,
          entityType: "application",
          entityId: id,
          eventType: "documents_requested",
          metadata: {
            requestedDocumentTypes,
            requestedLabels,
            message: requestMessage,
            applyUrl,
            emailSent,
            emailError,
          },
        },
      });

      documentRequest = { emailSent, emailError, applyUrl, requestedLabels };
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

    return Response.json({ ...app, documentRequest });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
