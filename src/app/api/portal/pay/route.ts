import { NextRequest, NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/portal-session";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requirePortalSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rentPaymentId } = await req.json();
  const lease = session.tenant.leaseLinks[0]?.lease;
  if (!lease) return NextResponse.json({ error: "No active lease" }, { status: 400 });

  const payment = await prisma.rentPayment.findFirst({
    where: { id: rentPaymentId, leaseId: lease.id },
  });

  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (payment.status === "paid") return NextResponse.json({ error: "Already paid" }, { status: 400 });

  const org = await prisma.organization.findUnique({
    where: { id: payment.organizationId },
    select: { stripeAccountId: true },
  });

  if (!org?.stripeAccountId) {
    return NextResponse.json({ error: "Online payments not set up by your landlord" }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const rentCents = Math.round(Number(payment.amountDue) * 100);
  const feeCents = Math.round(rentCents * 0.029) + 30; // 2.9% + $0.30
  const period = new Date(payment.dueDate).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const baseUrl = process.env.NEXTAUTH_URL;

  const checkoutSession = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card", "us_bank_account"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `Rent — ${period}` },
            unit_amount: rentCents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Processing fee" },
            unit_amount: feeCents,
          },
          quantity: 1,
        },
      ],
      metadata: { rentPaymentId: payment.id },
      success_url: `${baseUrl}/portal/payments?paid=true`,
      cancel_url: `${baseUrl}/portal/payments`,
    },
    { stripeAccount: org.stripeAccountId }
  );

  return NextResponse.json({ url: checkoutSession.url });
}
