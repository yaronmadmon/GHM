import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createNotifications } from "@/lib/notifications";
import { sendNewApplicationAlert, APP_URL } from "@/lib/email";

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
  signatureData: z.string().optional(),
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

  return Response.json({
    propertyName: invite.property.name,
    propertyAddress: `${invite.property.addressLine1}, ${invite.property.city}, ${invite.property.state}`,
    unitNumber: invite.unit?.unitNumber ?? null,
    organizationId: invite.organizationId,
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

    const ipAddress = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";

    const { references, ...appData } = data;

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
