import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const TYPES = ["move_in", "move_out", "annual", "maintenance"] as const;
const STATUSES = ["scheduled", "in_progress", "completed", "cancelled"] as const;

const createSchema = z.object({
  propertyId: z.string(),
  unitId: z.string().optional().nullable(),
  leaseId: z.string().optional().nullable(),
  tenantId: z.string().optional().nullable(),
  inspectionType: z.enum(TYPES),
  scheduledDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  checklist: z.any().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const propertyId = searchParams.get("propertyId");
    const type = searchParams.get("type");

    const inspections = await prisma.inspection.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
        ...(propertyId ? { propertyId } : {}),
        ...(type ? { inspectionType: type } : {}),
      },
      orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
    });

    return Response.json(
      inspections.map((i) => ({
        ...i,
        scheduledDate: i.scheduledDate?.toISOString() ?? null,
        completedDate: i.completedDate?.toISOString() ?? null,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      })),
    );
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const body = await req.json();
    const data = createSchema.parse(body);

    const inspection = await prisma.inspection.create({
      data: {
        ...data,
        organizationId,
        createdById: userId,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
        checklist: data.checklist ?? null,
      },
    });

    return Response.json(
      {
        ...inspection,
        scheduledDate: inspection.scheduledDate?.toISOString() ?? null,
        completedDate: null,
        createdAt: inspection.createdAt.toISOString(),
        updatedAt: inspection.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
