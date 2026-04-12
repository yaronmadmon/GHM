import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { addMinutes } from "date-fns";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });

    // Always return success to avoid email enumeration
    if (!tenant) {
      return Response.json({ ok: true });
    }

    // Delete existing magic tokens for this tenant
    await prisma.portalSession.deleteMany({
      where: { tenantId: tenant.id, type: "magic" },
    });

    const session = await prisma.portalSession.create({
      data: {
        tenantId: tenant.id,
        type: "magic",
        expiresAt: addMinutes(new Date(), 15),
      },
    });

    const url = `${process.env.NEXTAUTH_URL}/portal/auth/${session.token}`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "noreply@yourdomain.com",
      to: email,
      subject: "Your Tenant Portal Login Link",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="margin-bottom: 8px;">Sign in to your Tenant Portal</h2>
          <p style="color: #555; margin-bottom: 24px;">Click the button below to access your portal. This link expires in 15 minutes.</p>
          <a href="${url}" style="display: inline-block; background: #18181b; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
            Access My Portal
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">If you didn't request this, you can safely ignore this email.</p>
          <p style="color: #bbb; font-size: 11px;">Link: ${url}</p>
        </div>
      `,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to send link" }, { status: 500 });
  }
}
