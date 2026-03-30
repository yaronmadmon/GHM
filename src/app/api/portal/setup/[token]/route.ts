import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await prisma.user.findFirst({
    where: { portalInviteToken: token, portalInviteExpiry: { gt: new Date() } },
    select: { email: true, name: true },
  });
  if (!user) return Response.json({ error: "Invalid or expired invite link" }, { status: 404 });
  return Response.json(user);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const body = await req.json();
    const { password } = z.object({ password: z.string().min(8) }).parse(body);

    const user = await prisma.user.findFirst({
      where: { portalInviteToken: token, portalInviteExpiry: { gt: new Date() } },
    });
    if (!user) return Response.json({ error: "Invalid or expired invite link" }, { status: 404 });

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, portalInviteToken: null, portalInviteExpiry: null },
    });

    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) return Response.json({ error: err.issues }, { status: 400 });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
