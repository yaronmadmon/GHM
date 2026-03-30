import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
  country: z.string().default("US"),
  propertyType: z.enum(["single_family", "multi_unit", "condo", "commercial"]).default("single_family"),
  unitCount: z.number().int().positive().default(1),
  status: z.enum(["occupied", "vacant", "under_maintenance"]).default("vacant"),
  description: z.string().optional(),
  purchasePrice: z.number().optional(),
  purchaseDate: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const includeArchived = searchParams.get("archived") === "true";
    const search = searchParams.get("search");

    const properties = await prisma.property.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
        ...(!includeArchived ? { archivedAt: null } : {}),
        ...(search ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { addressLine1: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
          ],
        } : {}),
      },
      include: {
        photos: { where: { isCover: true }, take: 1 },
        units: { select: { id: true, status: true } },
        _count: { select: { units: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(properties);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const body = await req.json();
    const data = createSchema.parse(body);

    const property = await prisma.property.create({
      data: {
        ...data,
        organizationId,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      },
    });

    await prisma.activityEvent.create({
      data: {
        organizationId,
        actorId: userId,
        entityType: "property",
        entityId: property.id,
        eventType: "created",
        metadata: { name: property.name, address: property.addressLine1 },
      },
    });

    return Response.json(property, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
