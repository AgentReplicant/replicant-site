// components/sections/hero.tsx
"use client";

import React from "react";

export default function Hero() {
  return (
    <section className="relative w-full pt-28 pb-24">
      <div className="mx-auto max-w-5xl px-6">
        <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight tracking-tight text-white">
          Websites Built to Bring Service Businesses More{" "}
          <span className="text-sky-400">Bookings, Calls, and Quote Requests</span>
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-2xl">
          Replicant builds clean, mobile-first websites for local service
          businesses — with optional AI assistants that answer questions,
          capture leads, and help customers take the next step.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {/* PRIMARY: Free Website Audit → existing /get-started */}
          <a
            href="/get-started"
            className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-4 py-2 text-white font-medium shadow hover:shadow-lg transition"
          >
            Get a Free Website Audit
          </a>

          {/* SECONDARY: scroll to pricing */}
          <a
            href="#pricing"
            className="inline-flex items-center justify-center rounded-lg bg-slate-800/70 border border-slate-700 px-4 py-2 text-slate-100 font-medium hover:bg-slate-800 transition"
          >
            See Website Packages
          </a>
        </div>
      </div>
    </section>
  );
}