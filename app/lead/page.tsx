"use client";

import dynamic from "next/dynamic";
// relative path: app/lead/page.tsx -> app/ui/LeadForm.tsx
const LeadForm = dynamic(() => import("../ui/LeadForm"), { ssr: false });

export default function LeadPage() {
  return (
    <main className="min-h-screen bg-[#0B1220] text-white">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold">Get Started</h1>
          <p className="mt-2 text-white/70">Tell us about your use case—this goes straight to the team.</p>
        </header>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <LeadForm />
        </div>

        <p className="mt-4 text-sm text-white/50">
          We’ll create an Airtable lead and send an alert to <span className="text-white">alerts@replicantapp.com</span>.
        </p>
      </div>
    </main>
  );
}
