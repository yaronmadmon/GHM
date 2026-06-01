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

    const payment = await prisma.rentPayment.findUnique({
      where: { id: rentPaymentId },
      include: { lease: { select: { unitId: true, unit: { select: { propertyId: true } } } } },
    });
    if (!payment) return NextResponse.json({ ok: true });

    const totalCharged = (session.amount_total ?? 0) / 100;
    const rentCollected = Math.max(0, Number(payment.amountDue) - Number(payment.amountPaid));
    if (rentCollected <= 0) return NextResponse.json({ ok: true });
    const stripeFee = totalCharged - rentCollected;

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

    if (rentCollected > 0) {
      await prisma.transaction.create({
        data: {
          organizationId: payment.organizationId,
          leaseId: payment.leaseId,
          propertyId: payment.lease.unit?.propertyId ?? null,
          unitId: payment.lease.unitId,
          type: "income",
          category: "rent",
          amount: rentCollected,
          date: new Date(),
          description: `Rent payment ${payment.periodYear}-${String(payment.periodMonth).padStart(2, "0")}`,
          paymentMethod: "stripe",
          referenceId: payment.id,
        },
      });

      await prisma.activityEvent.create({
        data: {
          organizationId: payment.organizationId,
          entityType: "payment",
          entityId: payment.id,
          eventType: "payment_recorded",
          metadata: {
            amount: rentCollected,
            totalPaid: Number(payment.amountDue),
            status: "paid",
            period: `${payment.periodYear}-${payment.periodMonth}`,
            source: "portal",
          },
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
