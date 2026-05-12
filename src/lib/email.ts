import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "GHM <noreply@resend.dev>";
const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
let resend: Resend | null = null;

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  resend ??= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

async function send(to: string, subject: string, html: string) {
  const client = getResend();
  if (!client) { throw new Error("Email not configured: RESEND_API_KEY is missing"); }
  await client.emails.send({ from: FROM, to, subject, html });
}

export async function sendNewApplicationAlert(to: string, applicantName: string, propertyName: string, applicationUrl: string) {
  await send(to, `New application from ${applicantName} — ${propertyName}`, `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2>New Rental Application Received</h2>
      <p><strong>${applicantName}</strong> has submitted a rental application for <strong>${propertyName}</strong>.</p>
      <a href="${applicationUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">
        Review Application
      </a>
      <p style="color:#666;font-size:14px">Log in to GHM to review documents, run screening, and approve or deny.</p>
    </div>
  `);
}

export async function sendApplicationInvite(to: string, name: string, applyUrl: string, propertyName: string) {
  await send(to, `You've been invited to apply for ${propertyName}`, `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2>Rental Application Invitation</h2>
      <p>Hi ${name || "there"},</p>
      <p>You've been invited to apply for a rental at <strong>${propertyName}</strong>.</p>
      <p>Click the button below to fill out your application — it only takes a few minutes.</p>
      <a href="${applyUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">
        Start Application
      </a>
      <p style="color:#666;font-size:14px">Or copy this link: ${applyUrl}</p>
    </div>
  `);
}

export async function sendLeaseForSigning(to: string, tenantName: string, signUrl: string, propertyName: string, notes?: string) {
  await send(to, `Your lease is ready to sign — ${propertyName}`, `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2>Lease Ready for Your Signature</h2>
      <p>Hi ${tenantName},</p>
      <p>Your lease agreement for <strong>${propertyName}</strong> is ready. Please review and sign it at your earliest convenience.</p>
      ${notes ? `<div style="background:#f5f5f5;padding:12px 16px;border-radius:6px;margin:12px 0;color:#333"><strong>Message from your landlord:</strong><br/>${notes}</div>` : ""}
      <a href="${signUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">
        Review &amp; Sign Lease
      </a>
      <p style="color:#666;font-size:14px">Or copy this link: ${signUrl}</p>
    </div>
  `);
}

export async function sendNonRenewalNotice(to: string, tenantName: string, propertyName: string, endDate: Date, notes?: string) {
  const formatted = endDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  await send(to, `Notice: Lease non-renewal — ${propertyName}`, `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2>Lease Non-Renewal Notice</h2>
      <p>Hi ${tenantName},</p>
      <p>This is to inform you that your lease at <strong>${propertyName}</strong> will not be renewed. Your lease ends on <strong>${formatted}</strong>.</p>
      ${notes ? `<div style="background:#f5f5f5;padding:12px 16px;border-radius:6px;margin:12px 0;color:#333"><strong>Additional note:</strong><br/>${notes}</div>` : ""}
      <p>Please make arrangements accordingly. Contact your landlord if you have any questions.</p>
    </div>
  `);
}

export async function sendLeaseSigned(to: string, landlordName: string, tenantName: string, signUrl: string) {
  await send(to, `${tenantName} has signed the lease — your countersignature needed`, `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2>Tenant Signed — Your Turn</h2>
      <p>Hi ${landlordName || "there"},</p>
      <p><strong>${tenantName}</strong> has signed the lease. Please log in to countersign and finalize it.</p>
      <a href="${signUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">
        Countersign Lease
      </a>
    </div>
  `);
}

export async function sendPortalInvite(to: string, tenantName: string, setupUrl: string, propertyName: string) {
  await send(to, `Set up your tenant portal — ${propertyName}`, `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2>Welcome to Your Tenant Portal</h2>
      <p>Hi ${tenantName},</p>
      <p>Your tenancy at <strong>${propertyName}</strong> has been set up. Create your portal account to view your lease, submit maintenance requests, and communicate with your landlord.</p>
      <a href="${setupUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">
        Set Up Portal Account
      </a>
      <p style="color:#666;font-size:14px">This link expires in 7 days.</p>
    </div>
  `);
}

export async function sendLedgerReport({
  to,
  toName,
  tenantName,
  orgName,
  ledgerHtml,
  message,
}: {
  to: string;
  toName?: string;
  tenantName: string;
  orgName: string;
  ledgerHtml: string;
  message?: string;
}) {
  await send(to, `Rent Ledger — ${tenantName} (from ${orgName})`, `
    <div style="font-family:sans-serif;max-width:700px;margin:0 auto">
      <h2 style="margin-bottom:4px">Tenant Rent Ledger</h2>
      <p style="color:#666;margin-top:0">Prepared by <strong>${orgName}</strong></p>
      ${message ? `<p style="background:#f5f5f5;padding:12px 16px;border-radius:6px;color:#333">${message}</p>` : ""}
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
      ${ledgerHtml}
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
      <p style="color:#999;font-size:12px">This document was sent securely from ${orgName} via GHM Property Management.</p>
    </div>
  `);
}

export { APP_URL };
