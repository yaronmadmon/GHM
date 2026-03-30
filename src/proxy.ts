import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;

  const isAuthRoute = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/register");
  const isPublicApiRoute = nextUrl.pathname.startsWith("/api/apply") || nextUrl.pathname.startsWith("/api/auth") || nextUrl.pathname.startsWith("/api/uploadthing") || nextUrl.pathname.startsWith("/api/lease-sign") || nextUrl.pathname.startsWith("/api/portal/setup");
  const isPublicPage = nextUrl.pathname.startsWith("/apply") || nextUrl.pathname.startsWith("/lease-sign") || nextUrl.pathname.startsWith("/portal/setup");
  const isApiRoute = nextUrl.pathname.startsWith("/api/");

  if (isAuthRoute) {
    if (isLoggedIn) return NextResponse.redirect(new URL("/dashboard", nextUrl));
    return NextResponse.next();
  }

  if (isPublicPage || isPublicApiRoute) return NextResponse.next();

  if (isApiRoute) {
    if (!isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  if (!isLoggedIn && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
