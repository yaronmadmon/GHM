import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/session";

export async function GET() {
  try {
    await requireOrg();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.STRIPE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/stripe/connect/callback`;
  const url = new URL("https://connect.stripe.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", "read_write");
  url.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(url.toString());
}
