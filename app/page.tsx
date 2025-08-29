// app/page.tsx
import Navbar from "@/components/navbar";
import Hero from "@/components/sections/hero";
import { Logos } from "@/components/sections/logos";
import { Features } from "@/components/sections/features";
import { HowItWorks } from "@/components/sections/howitworks";
import { Trust } from "@/components/sections/trust";
import CTA from "@/components/sections/cta";
import { Footer } from "@/components/footer";

// NOTE: LeadForm is inside /app/ui, so use a relative import
import LeadForm from "./ui/LeadForm";

export default function Page() {
  return (
    <main className="relative min-h-screen bg-[#0B1220] text-white overflow-x-clip">
      {/* Subtle gradient/texture background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 50% -10%, rgba(78,119,255,0.10) 0%, rgba(78,119,255,0.00) 60%)",
        }}
      />

      <Navbar />

      <Hero />
      <Logos />
      <Features />
      <HowItWorks />
      <Trust />

      <CTA />

      {/* Embedded lead form on the homepage */}
      <section id="get-started" className="py-16 scroll-mt-24">
        <div className="mx-auto max-w-2xl px-6">
          <header className="mb-6">
            <h2 className="text-2xl font-semibold">Get Started</h2>
            <p className="mt-2 text-white/70">
              Tell us about your use case—this goes straight to the team.
            </p>
          </header>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <LeadForm />
          </div>

          <p className="mt-4 text-sm text-white/50">
            We’ll create an Airtable lead and send an alert to{" "}
            <span className="text-white">alerts@replicantapp.com</span>.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
