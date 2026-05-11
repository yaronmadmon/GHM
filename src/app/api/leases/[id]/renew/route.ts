import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { sendLeaseForSigning, APP_URL } from "@/lib/email";
import crypto from "crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;
    const body = await req.json();
    const { startDate, endDate, rentAmount, leaseType, paymentDueDay, notes } = body;

    const existing = await prisma.lease.findFirst({
      where: { id, organizationId },
      include: {
        unit: { include: { property: true } },
        tenants: { include: { tenant: true } },
      },
    });
    if (!existing) return Response.json({ error: "Lease not found" }, { status: 404 });

    const primaryTenantEntry = existing.tenants.find((lt) => lt.isPrimary) ?? existing.tenants[0];
    const tenant = primaryTenantEntry?.tenant;
    if (!tenant?.email) return Response.json({ error: "Primary tenant has no email address" }, { status: 400 });

    const token = crypto.randomBytes(32).toString("hex");

    const newLease = await prisma.lease.create({
      data: {
        organizationId,
        unitId: existing.unitId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        rentAmount,
        leaseType: leaseType ?? existing.leaseType,
        paymentDueDay: paymentDueDay ?? existing.paymentDueDay,
        depositAmount: existing.depositAmount,
        lateFeeAmount: existing.lateFeeAmount,
        lateFeGraceDays: existing.lateFeGraceDays,
        notes: notes || existing.notes,
        status: "pending",
        signingStatus: "sent",
        signingToken: token,
      },
    });

    await prisma.leaseTenant.createMany({
      data: existing.tenants.map((lt) => ({
        leaseId: newLease.id,
        tenantId: lt.tenantId,
        isPrimary: lt.isPrimary,
      })),
    });

    const signUrl = `${APP_URL}/lease-sign/${token}`;
    await sendLeaseForSigning(
      tenant.email,
      `${tenant.firstName} ${tenant.lastName}`,
      signUrl,
      existing.unit.property.name,
      notes,
    );

    return Response.json({ leaseId: newLease.id }, { status: 201 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
