import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  relatedType: z.string().optional(),
  relatedId: z.string().optional(),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  tenantId: z.string().optional(),
  leaseId: z.string().optional(),
  applicationId: z.string().optional(),
  maintenanceId: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const tenantId = searchParams.get("tenantId");
    const dueToday = searchParams.get("dueToday") === "true";

    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const tasks = await prisma.task.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(tenantId ? { tenantId } : {}),
        ...(dueToday ? { dueDate: { lte: todayEnd } } : {}),
      },
      orderBy: [
        { status: "asc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
    });

    return Response.json(tasks);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireOrg();
    const body = await req.json();
    const data = createSchema.parse(body);

    const task = await prisma.task.create({
      data: {
        ...data,
        organizationId,
        createdById: userId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    });

    return Response.json(task, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
