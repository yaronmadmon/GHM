import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const createSchema = z.object({
  propertyId: z.string(),
  unitId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "emergency"]).default("medium"),
  category: z.string().optional(),
  assignedVendorId: z.string().optional(),
  estimatedCost: z.number().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const propertyId = searchParams.get("propertyId");

    const requests = await prisma.maintenanceRequest.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(propertyId ? { propertyId } : {}),
      },
      include: {
        property: true,
        unit: true,
        assignedVendor: true,
        reportedByTenant: true,
        _count: { select: { comments: true } },
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    return Response.json(requests);
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

    const request = await prisma.maintenanceRequest.create({
      data: { ...data, organizationId },
      include: { property: true, unit: true },
    });

    await prisma.activityEvent.create({
      data: {
        organizationId,
        actorId: userId,
        entityType: "maintenance",
        entityId: request.id,
        eventType: "created",
        metadata: { title: request.title, priority: request.priority, property: property.name },
      },
    });

    return Response.json(request, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
