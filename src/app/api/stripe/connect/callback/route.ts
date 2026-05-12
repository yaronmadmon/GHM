import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export async function GET(req: NextRequest) {
  let orgId: string;
  try {
    const { organizationId } = await requireOrg();
    orgId = organizationId;
  } catch {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/settings?stripe=cancelled", req.nextUrl));
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const response = await stripe.oauth.token({ grant_type: "authorization_code", code });

    await prisma.organization.update({
      where: { id: orgId },
      data: { stripeAccountId: response.stripe_user_id },
    });

    return NextResponse.redirect(new URL("/settings?stripe=connected", req.nextUrl));
  } catch {
    return NextResponse.redirect(new URL("/settings?stripe=error", req.nextUrl));
  }
}
