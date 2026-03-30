import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId } = await requireOrg();
    const { id: requestId } = await params;
    const body = await req.json();
    const { body: commentBody } = z.object({ body: z.string().min(1) }).parse(body);

    const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, organizationId } });
    if (!request) return Response.json({ error: "Not found" }, { status: 404 });

    const comment = await prisma.maintenanceComment.create({
      data: { requestId, authorId: userId, body: commentBody },
      include: { author: true },
    });

    return Response.json(comment, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues ?? [err.message] }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
