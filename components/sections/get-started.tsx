// components/sections/get-started.tsx
import LeadForm from "@/app/ui/LeadForm"; // Client component; safe to import from a Server Component

export default function GetStartedSection() {
  return (
    <section id="get-started" className="py-16 md:py-24">
      <div className="mx-auto max-w-2xl px-4">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Get a Free Website Audit
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Tell us a bit about your business — services, current site (if any),
          and what you want customers to do. We’ll review and reply with next
          steps.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur">
          <LeadForm />
        </div>
      </div>
    </section>
  );
}