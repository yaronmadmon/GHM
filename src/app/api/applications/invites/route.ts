import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";
import { randomBytes } from "crypto";
import { sendApplicationInvite, APP_URL } from "@/lib/email";

const createSchema = z.object({
  propertyId: z.string(),
  unitId: z.string().optional(),
  expiresAt: z.string().optional(),
  sendToEmail: z.string().email().optional(),
  sendToName: z.string().optional(),
});

export async function GET() {
  try {
    const { organizationId } = await requireOrg();
    const invites = await prisma.applicationInvite.findMany({
      where: { organizationId },
      include: {
        property: true,
        unit: true,
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(invites);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const body = await req.json();
    const data = createSchema.parse(body);

    const property = await prisma.property.findFirst({ where: { id: data.propertyId, organizationId } });
    if (!property) return Response.json({ error: "Property not found" }, { status: 404 });

    const token = randomBytes(32).toString("hex");

    const invite = await prisma.applicationInvite.create({
      data: {
        organizationId,
        propertyId: data.propertyId,
        unitId: data.unitId,
        token,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        createdById: userId,
      },
      include: { property: true, unit: true },
    });

    let emailSent = false;
    // Send email if requested
    if (data.sendToEmail) {
      const applyUrl = `${APP_URL}/apply/${token}`;
      try {
        await sendApplicationInvite(data.sendToEmail, data.sendToName ?? "", applyUrl, invite.property.name);
        emailSent = true;
      } catch (emailErr) {
        console.error("Failed to send invite email:", emailErr);
        // Don't fail the request — return the invite with emailSent=false so UI can warn
      }
    }

    return Response.json({ ...invite, emailSent, applyUrl: `${APP_URL}/apply/${token}` }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
