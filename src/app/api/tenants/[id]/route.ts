import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  ssnLast4: z.string().max(4).nullable().optional(),
  emergencyContactName: z.string().nullable().optional(),
  emergencyContactPhone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;

    const tenant = await prisma.tenant.findFirst({
      where: { id, organizationId },
      include: {
        leaseLinks: {
          include: {
            lease: {
              include: {
                unit: { include: { property: true } },
                rentPayments: { orderBy: { dueDate: "desc" }, take: 12 },
              },
            },
          },
        },
      },
    });

    if (!tenant) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(tenant);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireOrg();
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.tenant.findFirst({ where: { id, organizationId } });
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    const { dateOfBirth, ...rest } = data;
    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...rest,
        ...(dateOfBirth !== undefined ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null } : {}),
      },
    });
    return Response.json(tenant);
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
