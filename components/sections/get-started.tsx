"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

// components/sections  ->  app/ui/LeadForm
const LeadForm = dynamic(() => import("@/app/ui/LeadForm"), { ssr: false });

export default function GetStarted() {
  return (
    <section id="get-started" className="scroll-mt-28 py-16 md:py-24">
      <div className="mx-auto max-w-2xl px-6">
        <h2 className="text-3xl font-semibold">Get started</h2>
        <p className="mt-2 text-white/70">
          Tell us about your use case—this goes straight to the team.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <Suspense fallback={<div className="text-white/60">Loading form…</div>}>
            <LeadForm />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
