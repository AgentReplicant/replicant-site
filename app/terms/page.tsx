import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Replicant",
  description: "The rules and responsibilities for using Replicant.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0B1220] text-white">
      <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Terms of Service</h1>
          <p className="text-white/70">Last updated: {new Date().toLocaleDateString()}</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Agreement</h2>
          <p className="text-white/80">
            By using Replicant (“Service”), you agree to these Terms. If you’re using the Service on behalf of an
            organization, you represent that you have authority to bind that organization.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Acceptable use</h2>
          <ul className="list-disc pl-6 text-white/80 space-y-2">
            <li>No illegal, harmful, or abusive behavior.</li>
            <li>Respect opt-in/consent and recording laws in your region.</li>
            <li>Do not attempt to reverse engineer or misuse the Service.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Accounts & data</h2>
          <ul className="list-disc pl-6 text-white/80 space-y-2">
            <li>You’re responsible for safeguarding credentials and account activity.</li>
            <li>We handle personal data per our Privacy Policy.</li>
            <li>You retain ownership of your content; you grant us a limited license to operate the Service.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Billing</h2>
          <p className="text-white/80">
            Paid plans are billed via Stripe. Charges are non-refundable unless required by law. You may cancel
            future billing at any time; access remains through the end of the current term.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Disclaimers</h2>
          <p className="text-white/80">
            The Service is provided “as is” without warranties of any kind. We do not guarantee uninterrupted
            availability or particular outcomes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Limitation of liability</h2>
          <p className="text-white/80">
            To the maximum extent permitted by law, Replicant is not liable for indirect, incidental, special,
            consequential, or punitive damages, or lost profits or revenues.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Changes</h2>
          <p className="text-white/80">
            We may update these Terms from time to time. Continued use after changes means you accept the updated Terms.
          </p>
        </section>

        <footer className="text-white/60">
          Questions? Email <span className="text-white">support@replicantapp.com</span>.
        </footer>
      </div>
    </main>
  );
}
