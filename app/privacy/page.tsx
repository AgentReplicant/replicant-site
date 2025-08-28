import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Replicant",
  description:
    "How Replicant collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0B1220] text-white">
      <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Privacy Policy</h1>
          <p className="text-white/70">Last updated: {new Date().toLocaleDateString()}</p>
        </header>

        <section className="space-y-3 text-white/80">
          <p>
            We collect only the information needed to operate Replicant and to improve the service.
            We do not sell personal data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Information we collect</h2>
          <ul className="list-disc pl-6 text-white/80 space-y-2">
            <li>Contact details submitted via forms or chat (name, email, phone).</li>
            <li>Conversation transcripts and call/message metadata for quality, routing, and compliance.</li>
            <li>Billing information processed by Stripe (we don’t store full card details).</li>
            <li>Usage analytics and device info to make the product better and more reliable.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">How we use data</h2>
          <ul className="list-disc pl-6 text-white/80 space-y-2">
            <li>To qualify leads, schedule appointments, and provide support.</li>
            <li>To improve models, prompts, and routing (with safeguards).</li>
            <li>To send transactional notifications and service updates.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Service providers</h2>
          <p className="text-white/80">
            We use trusted providers such as Stripe (payments), Vercel (hosting), OpenAI/Twilio (AI/telephony),
            and analytics tools. These providers process data on our behalf under contracts and security standards.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Data retention</h2>
          <p className="text-white/80">
            We retain data only as long as necessary for the purposes above or as required by law. You can request deletion.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Your rights</h2>
          <p className="text-white/80">
            You can request access, correction, export, or deletion of your personal data by emailing
            <span className="text-white"> support@replicantapp.com</span>.
          </p>
        </section>

        <footer className="text-white/60">
          Questions? Email <span className="text-white">support@replicantapp.com</span>.
        </footer>
      </div>
    </main>
  );
}
