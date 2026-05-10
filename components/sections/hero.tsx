// components/sections/hero.tsx
"use client";

import React from "react";

export default function Hero() {
  return (
    <section className="relative w-full pt-32 pb-20 md:pt-40 md:pb-28">
      <div className="mx-auto max-w-4xl px-6">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight text-white">
          Websites That Bring More Bookings, Calls, and Quotes
        </h1>
        <p className="mt-6 text-base sm:text-lg text-white/70 max-w-2xl leading-relaxed">
          Replicant builds professional websites for service businesses — with
          optional assistants that answer questions, capture leads, and help
          customers take the next step.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          {/* PRIMARY: Free Website Audit → /website-audit */}
          <a
            href="/website-audit"
            className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-5 py-2.5 text-white font-medium shadow-lg shadow-sky-500/20 ring-1 ring-sky-400/20 hover:bg-sky-400 hover:shadow-sky-500/30 transition"
          >
            Get a Free Website Audit
          </a>

          {/* SECONDARY: scroll to pricing */}
          <a
            href="#pricing"
            className="inline-flex items-center justify-center rounded-lg bg-white/5 border border-white/10 px-5 py-2.5 text-white/90 font-medium hover:bg-white/10 hover:border-white/20 transition"
          >
            See Website Packages
          </a>
        </div>
      </div>
    </section>
  );
}