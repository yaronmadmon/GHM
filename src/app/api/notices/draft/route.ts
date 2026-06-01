import { NextRequest } from "next/server";
import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { calculateLeaseOutstandingBalance } from "@/lib/rent-ledger";

export const maxDuration = 30;

let _openai: OpenAI | null = null;
function getOpenAI() {
  _openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const NOTICE_PROMPTS: Record<string, string> = {
  late_fee_notice: "Draft a professional late rent notice. State the amount owed, reference the lease terms, and give a firm but polite deadline to pay (5 days). Include consequences if not paid (late fee per lease terms).",
  balance_reminder: "Draft a friendly balance reminder. Acknowledge partial payment if applicable, state the outstanding balance, and ask them to contact you to arrange payment.",
  renewal_offer: "Draft a lease renewal offer letter. Reference the current lease end date, propose renewal for another 12 months, and note the current rent amount (indicating whether it will change). Ask them to respond within 30 days.",
  non_renewal_notice: "Draft a non-renewal notice. State that the lease will not be renewed at the end of the current term, give the move-out date, and outline the move-out process (notice, inspection, deposit return timeline).",
  move_out_notice: "Draft a move-out instruction letter. Provide a checklist: final walkthrough scheduling, key return, utility cancellation, forwarding address, and expected deposit return timeline (within 30 days of move-out).",
  notice_to_enter: "Draft a notice to enter the unit. State the purpose (maintenance/inspection), proposed date and time, and the required 24-hour notice per lease terms.",
};

export async function POST(req: NextRequest) {
  try {
    const { organizationId } = await requireOrg();
    const { tenantId, leaseId, noticeType } = (await req.json()) as {
      tenantId: string;
      leaseId?: string;
      noticeType: string;
    };

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, organizationId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!tenant) return Response.json({ error: "Tenant not found" }, { status: 404 });

    let leaseContext = "";
    if (leaseId) {
      const lease = await prisma.lease.findFirst({
        where: { id: leaseId, organizationId },
        include: {
          unit: { include: { property: true } },
          rentPayments: true,
          transactions: true,
        },
      });
      if (lease) {
        const balance = calculateLeaseOutstandingBalance({
          rentPayments: lease.rentPayments,
          transactions: lease.transactions,
        });
        leaseContext = `
Property: ${lease.unit.property.name}, Unit ${lease.unit.unitNumber}
Monthly rent: $${Number(lease.rentAmount).toFixed(2)}
Lease ends: ${lease.endDate ? new Date(lease.endDate).toLocaleDateString() : "Month-to-month"}
Outstanding balance: $${balance.toFixed(2)}`;
      }
    }

    const instructions = NOTICE_PROMPTS[noticeType];
    if (!instructions) return Response.json({ error: "Unknown notice type" }, { status: 400 });

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are a property management professional drafting formal tenant notices. Write professional, legally appropriate notices. Do not include specific legal citations or threats. Use "Dear [Tenant Name]," as the greeting and end with "Sincerely," and a blank line for the landlord signature. Today's date: ${new Date().toLocaleDateString()}.`,
        },
        {
          role: "user",
          content: `Tenant name: ${tenant.firstName} ${tenant.lastName}\n${leaseContext}\n\nTask: ${instructions}`,
        },
      ],
    });

    return Response.json({
      draft: completion.choices[0]?.message?.content ?? "",
      tenantName: `${tenant.firstName} ${tenant.lastName}`,
    });
  } catch (err) {
    console.error("[NOTICE DRAFT]", err);
    return Response.json({ error: "Draft failed" }, { status: 500 });
  }
}
