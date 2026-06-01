import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createNotifications } from "@/lib/notifications";
import { sendNewApplicationAlert, APP_URL } from "@/lib/email";
import {
  APPLICATION_DOCUMENT_LABELS,
  APPLICATION_DOCUMENT_TYPES,
  REQUIRED_APPLICATION_DOCUMENT_LABELS,
  missingRequiredApplicationDocuments,
} from "@/lib/application-workflow";

const submittedDocumentSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
  fileKey: z.string().nullable().optional(),
  docType: z.enum(APPLICATION_DOCUMENT_TYPES),
});

const resubmitSchema = z.object({
  applicationId: z.string().min(1),
});

const documentTypeSet = new Set<string>(APPLICATION_DOCUMENT_TYPES);

function requestedTypesFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("requestedDocumentTypes" in metadata)) return [];
  const value = (metadata as { requestedDocumentTypes?: unknown }).requestedDocumentTypes;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is (typeof APPLICATION_DOCUMENT_TYPES)[number] => (
    typeof item === "string" && documentTypeSet.has(item)
  ));
}

function requestMessageFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("message" in metadata)) return null;
  const value = (metadata as { message?: unknown }).message;
  return typeof value === "string" ? value : null;
}

const submitSchema = z.object({
  // Personal
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  ssnLast4: z.string().max(4).optional(),

  // Identity & Move-In
  governmentIdType: z.string().optional(),
  desiredMoveInDate: z.string().optional(),
  intendedLeaseTerm: z.string().optional(),
  numberOfOccupants: z.number().int().optional(),

  // Employment
  employerName: z.string().optional(),
  employerPhone: z.string().optional(),
  jobTitle: z.string().optional(),
  employmentStartDate: z.string().optional(),
  monthlyIncome: z.number().optional(),
  selfEmployed: z.boolean().default(false),
  additionalIncomeSource: z.string().optional(),
  additionalIncomeMonthly: z.number().optional(),

  // Rental history
  currentAddress: z.string().optional(),
  currentAddressStartDate: z.string().optional(),
  currentLandlordName: z.string().optional(),
  currentLandlordPhone: z.string().optional(),
  previousAddress: z.string().optional(),
  previousLandlordName: z.string().optional(),
  previousLandlordPhone: z.string().optional(),
  reasonForMoving: z.string().optional(),
  everEvicted: z.boolean().optional(),
  evictionExplanation: z.string().optional(),

  // Background
  hasCriminalHistory: z.boolean().optional(),
  criminalHistoryExplanation: z.string().optional(),
  hasBankruptcy: z.boolean().optional(),
  bankruptcyExplanation: z.string().optional(),

  // Household & Pets
  additionalOccupants: z.array(z.object({
    name: z.string(),
    relationship: z.string().optional(),
    dateOfBirth: z.string().optional(),
  })).optional(),
  hasPets: z.boolean().default(false),
  petsDescription: z.string().optional(),
  hasVehicles: z.boolean().default(false),
  vehiclesDescription: z.string().optional(),

  // Emergency contact
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),

  // References
  references: z.array(z.object({
    type: z.string(),
    name: z.string(),
    relationship: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
  })).optional(),

  // Additional notes & signature
  additionalNotes: z.string().optional(),
  signatureData: z.string().min(1),
  documents: z.array(submittedDocumentSchema).default([]),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await prisma.applicationInvite.findFirst({
    where: { token, isActive: true },
    include: { property: true, unit: true },
  });

  if (!invite) return Response.json({ error: "Invalid or expired invite link" }, { status: 404 });
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return Response.json({ error: "This invite link has expired" }, { status: 410 });
  }

  const application = await prisma.application.findFirst({
    where: { inviteId: invite.id },
    orderBy: { createdAt: "desc" },
    include: { documents: { orderBy: { createdAt: "asc" } } },
  });

  const latestDocumentRequest = application?.status === "documents_requested"
    ? await prisma.activityEvent.findFirst({
        where: { organizationId: invite.organizationId, entityType: "application", entityId: application.id, eventType: "documents_requested" },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const requestDate = latestDocumentRequest?.createdAt ?? application?.reviewedAt ?? application?.updatedAt ?? null;
  const requestedDocumentTypes = application?.status === "documents_requested"
    ? requestedTypesFromMetadata(latestDocumentRequest?.metadata)
    : [];
  const fallbackRequestedTypes = application?.status === "documents_requested"
    ? missingRequiredApplicationDocuments(application.documents)
    : [];
  const finalRequestedTypes = requestedDocumentTypes.length
    ? requestedDocumentTypes
    : fallbackRequestedTypes.length
    ? fallbackRequestedTypes
    : application?.status === "documents_requested"
    ? ["other" as const]
    : [];
  const requestDocuments = application?.documents.filter((doc) => (
    finalRequestedTypes.includes(doc.docType as (typeof finalRequestedTypes)[number])
    && (!requestDate || doc.createdAt >= requestDate)
  )) ?? [];

  return Response.json({
    propertyName: invite.property.name,
    propertyAddress: `${invite.property.addressLine1}, ${invite.property.city}, ${invite.property.state}`,
    unitNumber: invite.unit?.unitNumber ?? null,
    organizationId: invite.organizationId,
    applicationRequest: application?.status === "documents_requested"
      ? {
          applicationId: application.id,
          applicantName: `${application.firstName} ${application.lastName}`.trim(),
          status: application.status,
          requestedDocumentTypes: finalRequestedTypes,
          requestedLabels: finalRequestedTypes.map((type) => APPLICATION_DOCUMENT_LABELS[type] ?? type),
          message: requestMessageFromMetadata(latestDocumentRequest?.metadata) ?? application.decisionNotes,
          requestedAt: requestDate?.toISOString() ?? null,
          documents: requestDocuments.map((doc) => ({
            id: doc.id,
            name: doc.name,
            url: doc.fileKey ? doc.url : "[stored]",
            docType: doc.docType ?? "other",
            fileKey: doc.fileKey,
            createdAt: doc.createdAt.toISOString(),
          })),
        }
      : null,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await prisma.applicationInvite.findFirst({
    where: { token, isActive: true },
  });

  if (!invite) return Response.json({ error: "Invalid or expired invite link" }, { status: 404 });
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return Response.json({ error: "This invite link has expired" }, { status: 410 });
  }

  try {
    const body = await req.json();
    const data = submitSchema.parse(body);

    const missingDocuments = missingRequiredApplicationDocuments(data.documents);
    if (missingDocuments.length) {
      return Response.json({
        error: `Required documents missing: ${missingDocuments.map((type) => REQUIRED_APPLICATION_DOCUMENT_LABELS[type]).join(", ")}.`,
      }, { status: 400 });
    }

    const ipAddress = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";

    const { references, documents, ...appData } = data;

    const application = await prisma.application.create({
      data: {
        ...appData,
        organizationId: invite.organizationId,
        inviteId: invite.id,
        propertyId: invite.propertyId,
        unitId: invite.unitId ?? undefined,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        desiredMoveInDate: data.desiredMoveInDate ? new Date(data.desiredMoveInDate) : undefined,
        employmentStartDate: data.employmentStartDate ? new Date(data.employmentStartDate) : undefined,
        additionalIncomeMonthly: data.additionalIncomeMonthly ?? undefined,
        additionalOccupants: data.additionalOccupants ?? undefined,
        signedAt: data.signatureData ? new Date() : undefined,
        ipAddress,
        status: "pending",
        references: references?.length
          ? { create: references }
          : undefined,
        documents: documents.length
          ? {
              create: documents.map((doc) => ({
                name: doc.name,
                url: doc.url,
                fileKey: doc.fileKey ?? null,
                docType: doc.docType,
              })),
            }
          : undefined,
      },
    });

    await prisma.activityEvent.create({
      data: {
        organizationId: invite.organizationId,
        entityType: "application",
        entityId: application.id,
        eventType: "created",
        metadata: { applicantName: `${data.firstName} ${data.lastName}`, email: data.email },
      },
    });

    // Notify staff users in the organization. Tenant portal users should not
    // receive landlord-side application alerts.
    const orgUsers = await prisma.user.findMany({
      where: { organizationId: invite.organizationId, role: { in: ["owner", "member", "admin"] } },
      select: { id: true, email: true, role: true },
    });
    const property = await prisma.property.findUnique({
      where: { id: invite.propertyId },
      select: { name: true },
    });
    const propertyName = property?.name ?? "a property";
    const applicantName = `${data.firstName} ${data.lastName}`;
    const applicationUrl = `${APP_URL}/applications/${application.id}`;

    // In-app notifications
    await createNotifications(
      orgUsers.map((u) => ({
        userId: u.id,
        type: "new_application",
        title: "New rental application",
        body: `${applicantName} applied for ${propertyName}`,
        relatedUrl: `/applications/${application.id}`,
      }))
    );

    // Email notifications (fire-and-forget — don't fail the request if email fails)
    const emailResults = await Promise.allSettled(
      orgUsers
        .filter((u) => u.email)
        .map((u) =>
          sendNewApplicationAlert(u.email!, applicantName, propertyName, applicationUrl)
        )
    );
    const failedEmailResults = emailResults.filter((result) => result.status === "rejected");
    if (failedEmailResults.length > 0) {
      console.error("Failed to send application alert email(s):", failedEmailResults);
    }

    return Response.json({
      id: application.id,
      status: "submitted",
      notificationsCreated: orgUsers.length,
      emailsAttempted: emailResults.length,
      emailsFailed: failedEmailResults.length,
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await prisma.applicationInvite.findFirst({
    where: { token, isActive: true },
    include: { property: true, unit: true },
  });

  if (!invite) return Response.json({ error: "Invalid or expired invite link" }, { status: 404 });
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return Response.json({ error: "This invite link has expired" }, { status: 410 });
  }

  try {
    const body = await req.json();
    const data = resubmitSchema.parse(body);

    const application = await prisma.application.findFirst({
      where: { id: data.applicationId, inviteId: invite.id, status: "documents_requested" },
      include: { documents: true },
    });
    if (!application) return Response.json({ error: "Application is not waiting for documents." }, { status: 404 });

    const latestDocumentRequest = await prisma.activityEvent.findFirst({
      where: {
        organizationId: invite.organizationId,
        entityType: "application",
        entityId: application.id,
        eventType: "documents_requested",
      },
      orderBy: { createdAt: "desc" },
    });
    const requestDate = latestDocumentRequest?.createdAt ?? application.reviewedAt ?? application.updatedAt;
    const requestedDocumentTypes = requestedTypesFromMetadata(latestDocumentRequest?.metadata);
    const fallbackRequestedTypes = missingRequiredApplicationDocuments(application.documents);
    const finalRequestedTypes = requestedDocumentTypes.length
      ? requestedDocumentTypes
      : fallbackRequestedTypes.length
      ? fallbackRequestedTypes
      : (["other"] as const);

    const uploadedTypes = new Set(
      application.documents
        .filter((doc) => !requestDate || doc.createdAt >= requestDate)
        .map((doc) => doc.docType)
        .filter((docType): docType is string => Boolean(docType))
    );
    const missing = finalRequestedTypes.filter((type) => !uploadedTypes.has(type));
    if (missing.length) {
      return Response.json({
        error: `Please upload: ${missing.map((type) => APPLICATION_DOCUMENT_LABELS[type] ?? type).join(", ")}.`,
      }, { status: 400 });
    }

    await prisma.application.update({
      where: { id: application.id },
      data: {
        status: "under_review",
        reviewedAt: new Date(),
      },
    });

    await prisma.activityEvent.create({
      data: {
        organizationId: invite.organizationId,
        entityType: "application",
        entityId: application.id,
        eventType: "documents_resubmitted",
        metadata: {
          requestedDocumentTypes: finalRequestedTypes,
          requestedLabels: finalRequestedTypes.map((type) => APPLICATION_DOCUMENT_LABELS[type] ?? type),
        },
      },
    });

    const orgUsers = await prisma.user.findMany({
      where: { organizationId: invite.organizationId, role: { in: ["owner", "member", "admin"] } },
      select: { id: true },
    });
    await createNotifications(orgUsers.map((user) => ({
      userId: user.id,
      type: "application_update",
      title: "Application documents uploaded",
      body: `${application.firstName} ${application.lastName} uploaded requested documents for ${invite.property.name}.`,
      relatedUrl: `/applications/${application.id}`,
    })));

    return Response.json({ status: "resubmitted", applicationId: application.id });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
