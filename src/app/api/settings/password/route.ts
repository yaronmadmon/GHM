import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { z } from "zod";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await requireOrg();
    const body = await req.json();
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }).parse(body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) return Response.json({ error: "Not found" }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return Response.json({ error: "Current password is incorrect" }, { status: 400 });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
