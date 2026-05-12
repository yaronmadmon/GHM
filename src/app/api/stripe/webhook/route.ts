import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const rentPaymentId = session.metadata?.rentPaymentId;
    if (!rentPaymentId) return NextResponse.json({ ok: true });

    const payment = await prisma.rentPayment.findUnique({ where: { id: rentPaymentId } });
    if (!payment) return NextResponse.json({ ok: true });

    const amountPaid = (session.amount_total ?? 0) / 100;
    const stripeFee = amountPaid - Number(payment.amountDue);

    await prisma.rentPayment.update({
      where: { id: rentPaymentId },
      data: {
        status: "paid",
        amountPaid: Number(payment.amountDue),
        paidAt: new Date(),
        paymentMethod: "stripe",
        stripePaymentIntentId: session.payment_intent as string ?? session.id,
        stripeFeeAmount: stripeFee > 0 ? stripeFee : 0,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
