export const metadata = {
  title: "Privacy Policy — Green Hill Management",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: May 7, 2026</p>

        <div className="space-y-8 text-sm text-gray-600 leading-relaxed">

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">1. Who We Are</h2>
            <p>
              Green Hill Management ("we", "us", "our") provides real estate acquisition and property
              management services. We are the data controller for the personal data we process.
            </p>
            <p>Contact: <a href="mailto:yaronmadmon@gmail.com" className="underline text-gray-900">yaronmadmon@gmail.com</a></p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">2. Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Name and contact information (phone number, email address, mailing address)</li>
              <li>Property information you share with us</li>
              <li>Communications history (calls, emails, SMS messages)</li>
              <li>Technical data: IP address, browser type (via standard web logs)</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To respond to your inquiries about selling or managing your property</li>
              <li>To send you information relevant to your property and our services</li>
              <li>To coordinate appointments, offers, and follow-ups</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">4. SMS and Text Messaging</h2>
            <p>
              By providing your mobile phone number and consenting to receive text messages from
              Green Hill Management, you agree to receive SMS communications regarding your property,
              including purchase inquiries, follow-ups, and appointment scheduling.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-gray-900">Mobile phone numbers are never shared with third parties</strong> for
                their own marketing or any other purposes.
              </li>
              <li>Message frequency varies (typically 1–5 messages per inquiry).</li>
              <li>Message and data rates may apply.</li>
              <li>
                To opt out, reply <strong className="text-gray-900">STOP</strong> to any message.
                You will receive one confirmation and no further messages will be sent.
              </li>
              <li>
                For help, reply <strong className="text-gray-900">HELP</strong> or email{" "}
                <a href="mailto:yaronmadmon@gmail.com" className="underline text-gray-900">yaronmadmon@gmail.com</a>.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">5. Data Sharing</h2>
            <p>
              We do not sell your personal data. We do not share your mobile phone number with
              third parties for marketing purposes. We may share data with service providers
              (e.g., cloud hosting, CRM software) solely to operate our business, under strict
              confidentiality obligations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">6. Data Retention</h2>
            <p>
              We retain your contact information for as long as necessary to fulfill the purpose
              for which it was collected, or as required by law. You may request deletion at any time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction or deletion of your data</li>
              <li>Opt out of SMS communications at any time by replying STOP</li>
              <li>Opt out of all communications by contacting us directly</li>
            </ul>
            <p>
              To exercise any right, email{" "}
              <a href="mailto:yaronmadmon@gmail.com" className="underline text-gray-900">yaronmadmon@gmail.com</a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">8. Security</h2>
            <p>
              We use industry-standard security measures to protect your personal data against
              unauthorized access, disclosure, or misuse.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">9. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be communicated
              via the contact information you provided.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">10. Contact</h2>
            <p>
              Questions? Email{" "}
              <a href="mailto:yaronmadmon@gmail.com" className="underline text-gray-900">yaronmadmon@gmail.com</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
