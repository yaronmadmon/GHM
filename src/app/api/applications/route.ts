import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const propertyId = searchParams.get("propertyId");

    const applications = await prisma.application.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
        ...(propertyId ? { propertyId } : {}),
      },
      include: {
        property: true,
        unit: true,
        invite: true,
        reviewedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(applications);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
