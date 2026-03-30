import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const createSchema = z.object({
  propertyId: z.string(),
  unitNumber: z.string().min(1),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  sqft: z.number().int().optional(),
  status: z.enum(["occupied", "vacant", "under_maintenance"]).default("vacant"),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId");

    const units = await prisma.unit.findMany({
      where: {
        ...(propertyId ? { propertyId } : {}),
        property: { organizationId },
      },
      include: {
        leases: {
          where: { status: "active" },
          include: { tenants: { include: { tenant: true } } },
        },
      },
      orderBy: { unitNumber: "asc" },
    });

    return Response.json(units);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const body = await req.json();
    const data = createSchema.parse(body);

    const property = await prisma.property.findFirst({ where: { id: data.propertyId, organizationId } });
    if (!property) return Response.json({ error: "Property not found" }, { status: 404 });

    const unit = await prisma.unit.create({ data });
    return Response.json(unit, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
