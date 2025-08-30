// app/components/sections/get-started.tsx
import dynamic from "next/dynamic";
const LeadForm = dynamic(() => import("@/app/ui/LeadForm"), { ssr: false });

export default function GetStartedSection() {
  return (
    <section id="get-started" className="py-16 md:py-24">
      <div className="mx-auto max-w-2xl px-4">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Get started</h2>
        <p className="mt-2 text-sm text-slate-400">
          Tell us about your use case—this goes straight to the team.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
          <LeadForm />
        </div>
      </div>
    </section>
  );
}
