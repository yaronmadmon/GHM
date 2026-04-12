import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setPortalCookie } from "@/lib/portal-session";
import { addDays } from "date-fns";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const magic = await prisma.portalSession.findUnique({
    where: { token },
  });

  if (!magic || magic.type !== "magic" || magic.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/portal/login?error=expired", process.env.NEXTAUTH_URL!));
  }

  // Delete the magic token
  await prisma.portalSession.delete({ where: { id: magic.id } });

  // Create a durable session
  const session = await prisma.portalSession.create({
    data: {
      tenantId: magic.tenantId,
      type: "session",
      expiresAt: addDays(new Date(), 7),
    },
  });

  const cookie = setPortalCookie(session.token);
  const res = NextResponse.redirect(new URL("/portal", process.env.NEXTAUTH_URL!));
  res.cookies.set(cookie);
  return res;
}
