import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const submitSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  employerName: z.string().optional(),
  employerPhone: z.string().optional(),
  jobTitle: z.string().optional(),
  employmentStartDate: z.string().optional(),
  monthlyIncome: z.number().optional(),
  currentAddress: z.string().optional(),
  currentLandlordName: z.string().optional(),
  currentLandlordPhone: z.string().optional(),
  previousAddress: z.string().optional(),
  reasonForMoving: z.string().optional(),
  hasPets: z.boolean().default(false),
  petsDescription: z.string().optional(),
  hasVehicles: z.boolean().default(false),
  vehiclesDescription: z.string().optional(),
  signatureData: z.string().optional(),
  references: z.array(z.object({
    type: z.string(),
    name: z.string(),
    relationship: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
  })).optional(),
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
        employmentStartDate: data.employmentStartDate ? new Date(data.employmentStartDate) : undefined,
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

    return Response.json({ id: application.id, status: "submitted" }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
