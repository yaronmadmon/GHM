import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const schema = z.object({
  gracePeriodDays: z.number().int().min(0),
  feeType: z.enum(["flat", "percentage"]),
  flatAmount: z.number().positive().nullable().optional(),
  percentage: z.number().positive().nullable().optional(),
  maxFeeAmount: z.number().positive().nullable().optional(),
});

export async function GET() {
  try {
    const { organizationId } = await requireOrg();
    const config = await prisma.lateFeeConfig.findUnique({ where: { organizationId } });
    if (!config) return Response.json({ gracePeriodDays: 5, feeType: "flat", flatAmount: 50, percentage: null, maxFeeAmount: null });
    return Response.json(config);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const body = await req.json();
    const data = schema.parse(body);

    const config = await prisma.lateFeeConfig.upsert({
      where: { organizationId },
      update: data,
      create: { ...data, organizationId },
    });
    return Response.json(config);
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
