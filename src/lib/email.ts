import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "GHM <noreply@resend.dev>";
const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

async function send(to: string, subject: string, html: string) {
  if (!resend) { console.log(`[email skipped - no RESEND_API_KEY] To: ${to} | Subject: ${subject}`); return; }
  await resend.emails.send({ from: FROM, to, subject, html });
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

export async function sendLeaseForSigning(to: string, tenantName: string, signUrl: string, propertyName: string) {
  await send(to, `Your lease is ready to sign — ${propertyName}`, `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2>Lease Ready for Your Signature</h2>
      <p>Hi ${tenantName},</p>
      <p>Your lease agreement for <strong>${propertyName}</strong> is ready. Please review and sign it at your earliest convenience.</p>
      <a href="${signUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">
        Review &amp; Sign Lease
      </a>
      <p style="color:#666;font-size:14px">Or copy this link: ${signUrl}</p>
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

export { APP_URL };
