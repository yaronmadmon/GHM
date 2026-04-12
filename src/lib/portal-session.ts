import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "portal_session";

export async function getPortalSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.portalSession.findUnique({
    where: { token },
    include: {
      tenant: {
        include: {
          leaseLinks: {
            where: { lease: { status: "active" } },
            include: {
              lease: {
                include: {
                  unit: { include: { property: true } },
                  rentPayments: { orderBy: { dueDate: "desc" }, take: 1 },
                  documents: true,
                },
              },
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!session || session.type !== "session" || session.expiresAt < new Date()) {
    return null;
  }

  return session;
}

export async function requirePortalSession() {
  const session = await getPortalSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export function setPortalCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/portal",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}

export function clearPortalCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/portal",
    maxAge: 0,
  };
}
