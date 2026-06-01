import { Resend } from "resend";
import { config } from "dotenv";
config({ path: ".env.local" });

const key = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;
console.log("API key present:", !!key, "| starts with re_:", key?.startsWith("re_"));
console.log("FROM:", from);

const resend = new Resend(key);
const { data, error } = await resend.emails.send({
  from: from ?? "onboarding@resend.dev",
  to: "yaronmadmon@gmail.com",
  subject: "GHM email test",
  html: "<p>Test email from GHM — if you see this, email is working.</p>",
});

if (error) {
  console.error("Resend error:", JSON.stringify(error, null, 2));
} else {
  console.log("Success! Email ID:", data?.id);
}
