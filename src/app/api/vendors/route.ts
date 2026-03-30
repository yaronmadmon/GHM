import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  trade: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const { organizationId } = await requireOrg();
    const vendors = await prisma.vendor.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
    return Response.json(vendors);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const body = await req.json();
    const data = createSchema.parse(body);
    const vendor = await prisma.vendor.create({ data: { ...data, organizationId } });
    return Response.json(vendor, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
