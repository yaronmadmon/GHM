import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPortalSession, clearPortalCookie } from "@/lib/portal-session";

export async function POST() {
  const session = await getPortalSession();
  if (session) {
    await prisma.portalSession.delete({ where: { id: session.id } });
  }
  const res = NextResponse.json({ ok: true });
  const cookie = clearPortalCookie();
  res.cookies.set(cookie);
  return res;
}
