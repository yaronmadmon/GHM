import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";

export async function GET() {
  try {
    const { userId } = await requireOrg();
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    if (!user) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(user);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await requireOrg();
    const body = await req.json();
    const { name } = z.object({ name: z.string().min(1) }).parse(body);
    const user = await prisma.user.update({ where: { id: userId }, data: { name } });
    return Response.json({ name: user.name, email: user.email });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
