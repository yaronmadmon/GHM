import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";
import { sendPortalInvite, APP_URL } from "@/lib/email";
import crypto from "crypto";

const convertSchema = z.object({
  startDate: z.string(),
  endDate: z.string().optional(),
  rentAmount: z.number().positive(),
  depositAmount: z.number().optional(),
  depositPaid: z.boolean().default(false),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId } = await requireOrg();
    const { id } = await params;
    const body = await req.json();
    const data = convertSchema.parse(body);

    const application = await prisma.application.findFirst({
      where: { id, organizationId },
    });
    if (!application) return Response.json({ error: "Not found" }, { status: 404 });
    if (application.status === "approved") return Response.json({ error: "Already converted" }, { status: 409 });
    if (!application.unitId) return Response.json({ error: "No unit associated with this application" }, { status: 400 });

    // Atomic transaction: create tenant + lease + update unit status + update application
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create tenant
      const tenant = await tx.tenant.create({
        data: {
          organizationId,
          firstName: application.firstName,
          lastName: application.lastName,
          email: application.email,
          phone: application.phone ?? undefined,
          dateOfBirth: application.dateOfBirth ?? undefined,
        },
      });

      // 2. Create lease
      const lease = await tx.lease.create({
        data: {
          organizationId,
          unitId: application.unitId!,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          rentAmount: data.rentAmount,
          depositAmount: data.depositAmount ?? undefined,
          depositPaid: data.depositPaid,
          status: "active",
          tenants: { create: { tenantId: tenant.id, isPrimary: true } },
        },
      });

      // 3. Update unit status
      await tx.unit.update({ where: { id: application.unitId! }, data: { status: "occupied" } });

      // 4. Update application
      const updatedApp = await tx.application.update({
        where: { id },
        data: {
          status: "approved",
          convertedTenantId: tenant.id,
          convertedLeaseId: lease.id,
          reviewedById: userId,
          reviewedAt: new Date(),
        },
      });

      // 5. Deactivate invite if exists
      if (application.inviteId) {
        await tx.applicationInvite.update({
          where: { id: application.inviteId },
          data: { isActive: false },
        });
      }

      // 6. Activity log
      await tx.activityEvent.create({
        data: {
          organizationId,
          actorId: userId,
          entityType: "application",
          entityId: id,
          eventType: "status_changed",
          metadata: { from: "pending", to: "approved", tenantId: tenant.id, leaseId: lease.id },
        },
      });

      return { tenant, lease, application: updatedApp };
    });

    // 7. Create portal account + send invite (outside transaction, non-blocking)
    if (application.email) {
      try {
        const inviteToken = crypto.randomBytes(32).toString("hex");
        const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const portalUser = await prisma.user.create({
          data: {
            organizationId,
            email: application.email,
            name: `${application.firstName} ${application.lastName}`,
            role: "tenant",
            portalInviteToken: inviteToken,
            portalInviteExpiry: expiry,
          },
        });
        await prisma.tenant.update({
          where: { id: result.tenant.id },
          data: { portalUserId: portalUser.id },
        });
        const unit = await prisma.unit.findUnique({ where: { id: application.unitId! }, include: { property: true } });
        if (unit) {
          const setupUrl = `${APP_URL}/portal/setup/${inviteToken}`;
          await sendPortalInvite(application.email, `${application.firstName} ${application.lastName}`, setupUrl, unit.property.name);
        }
      } catch (e) {
        console.error("Portal invite failed (non-blocking):", e);
      }
    }

    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
