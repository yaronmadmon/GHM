import { NextRequest } from "next/server";
import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const NOTICE_LABELS: Record<string, string> = {
  late_fee_notice: "Late Fee Notice",
  balance_reminder: "Balance Reminder",
  renewal_offer: "Lease Renewal Offer",
  non_renewal_notice: "Non-Renewal Notice",
  move_out_notice: "Move-Out Instructions",
  notice_to_enter: "Notice to Enter",
};

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const { tenantId, leaseId, noticeType, noticeText } = (await req.json()) as {
      tenantId: string;
      leaseId?: string;
      noticeType: string;
      noticeText: string;
    };

    if (!tenantId || !noticeType || !noticeText) {
      return Response.json({ error: "tenantId, noticeType, noticeText required" }, { status: 400 });
    }

    // Verify tenant belongs to org
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, organizationId },
      select: { id: true },
    });
    if (!tenant) return Response.json({ error: "Not found" }, { status: 404 });

    const label = NOTICE_LABELS[noticeType] ?? noticeType.replace(/_/g, " ");

    // Log to ActivityEvent with full notice text in metadata
    const event = await prisma.activityEvent.create({
      data: {
        organizationId,
        actorId: userId,
        entityType: "tenant",
        entityId: tenantId,
        eventType: "notice_sent",
        metadata: {
          noticeType,
          noticeLabel: label,
          noticeText,
          leaseId: leaseId ?? null,
          sentAt: new Date().toISOString(),
        },
      },
    });

    // Also log against the lease if provided
    if (leaseId) {
      await prisma.activityEvent.create({
        data: {
          organizationId,
          actorId: userId,
          entityType: "lease",
          entityId: leaseId,
          eventType: "notice_sent",
          metadata: {
            noticeType,
            noticeLabel: label,
            noticeText,
            tenantId,
            sentAt: new Date().toISOString(),
          },
        },
      });
    }

    return Response.json({ ok: true, eventId: event.id, label });
  } catch (err) {
    console.error("[NOTICE LOG]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
