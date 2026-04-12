import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePortalSession } from "@/lib/portal-session";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "emergency"]).default("medium"),
});

export async function GET() {
  try {
    const session = await requirePortalSession();
    const tenant = session.tenant;

    const requests = await prisma.maintenanceRequest.findMany({
      where: { reportedByTenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return Response.json(requests);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePortalSession();
    const tenant = session.tenant;
    const lease = tenant.leaseLinks[0]?.lease;
    if (!lease) return Response.json({ error: "No active lease" }, { status: 400 });

    const body = await req.json();
    const data = createSchema.safeParse(body);
    if (!data.success) return Response.json({ error: "Invalid input" }, { status: 400 });

    const request = await prisma.maintenanceRequest.create({
      data: {
        organizationId: tenant.organizationId,
        propertyId: lease.unit.propertyId,
        unitId: lease.unitId,
        reportedByTenantId: tenant.id,
        title: data.data.title,
        description: data.data.description ?? "",
        priority: data.data.priority,
        status: "open",
      },
    });

    return Response.json(request);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
