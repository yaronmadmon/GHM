import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  ssnLast4: z.string().max(4).optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const tenants = await prisma.tenant.findMany({
      where: {
        organizationId,
        ...(search ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        } : {}),
      },
      include: {
        leaseLinks: {
          include: {
            lease: {
              include: { unit: { include: { property: true } } },
            },
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return Response.json(tenants);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const body = await req.json();
    const data = createSchema.parse(body);

    const tenant = await prisma.tenant.create({
      data: {
        ...data,
        organizationId,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      },
    });

    await prisma.activityEvent.create({
      data: {
        organizationId,
        actorId: userId,
        entityType: "tenant",
        entityId: tenant.id,
        eventType: "created",
        metadata: { name: `${tenant.firstName} ${tenant.lastName}` },
      },
    });

    return Response.json(tenant, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
