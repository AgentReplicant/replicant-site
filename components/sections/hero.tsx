// components/sections/hero.tsx
"use client";

import React from "react";

const PRIMARY_CTA_CLASS =
  "inline-flex items-center justify-center rounded-lg bg-sky-500 px-5 py-2.5 text-white font-medium shadow-lg shadow-sky-500/20 ring-1 ring-sky-400/20 hover:bg-sky-400 hover:shadow-sky-500/30 transition";

const SECONDARY_CTA_CLASS =
  "inline-flex items-center justify-center rounded-lg bg-white/5 border border-white/10 px-5 py-2.5 text-white/90 font-medium hover:bg-white/10 hover:border-white/20 transition";

export default function Hero() {
  // CTAs use React.createElement to avoid clipboard angle-bracket corruption.
  const primaryCta = React.createElement(
    "a",
    { href: "/website-audit", className: PRIMARY_CTA_CLASS, key: "cta-primary" },
    "Get a Free Website Audit"
  );

  const secondaryCta = React.createElement(
    "a",
    { href: "#pricing", className: SECONDARY_CTA_CLASS, key: "cta-secondary" },
    "See Website Packages"
  );

  return (
    <section className="relative w-full overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      {/* Decorative background layers — pointer-events disabled, screen-reader hidden */}
      <div
        aria-hidden
        className="hero-grid-bg pointer-events-none absolute inset-0 opacity-60"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 80% 20%, rgba(14, 165, 233, 0.18), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
        style={{
          background:
            "linear-gradient(to bottom, transparent, var(--background))",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* Left column: existing hero content, unchanged copy/CTAs */}
          <div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight text-white">
              Websites That Bring More Bookings, Calls, and Quotes
            </h1>
            <p className="mt-6 text-base sm:text-lg text-white/70 max-w-2xl leading-relaxed">
              Replicant builds professional websites for service businesses — with
              optional assistants that answer questions, capture leads, and help
              customers take the next step.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              {primaryCta}
              {secondaryCta}
            </div>
          </div>

          {/* Right column: mockup. Hidden below lg to keep mobile CTAs above the fold. */}
          <div aria-hidden className="hidden lg:block">
            <HeroMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- Hero Mockup -----------------------------
 * Static decorative composition. No state, no inputs, no network calls.
 * Aria-hidden because it's visual furniture; the real value prop is in the
 * headline and CTAs to its left.
 * --------------------------------------------------------------------- */
function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Outer glow halo behind the browser card */}
      <div
        className="pointer-events-none absolute -inset-8 rounded-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(14, 165, 233, 0.22), transparent 75%)",
        }}
      />

      {/* Browser-chrome card */}
      <div className="relative rounded-xl border border-white/10 bg-[#11151b] shadow-2xl shadow-black/40">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/[0.15]" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/[0.15]" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/[0.15]" />
          <div className="ml-3 flex-1 rounded-md bg-white/5 px-3 py-1 text-xs text-white/40">
            yourbusiness.example
          </div>
        </div>

        {/* Fake site content — abstract blocks, no real text */}
        <div className="p-6">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-sky-400/70">
            Service Website
          </div>
          <div className="mb-4 text-lg font-semibold text-white/90">
            Book · Call · Get a Quote
          </div>

          <div className="space-y-2.5">
            <div className="h-2 w-full rounded bg-white/[0.08]" />
            <div className="h-2 w-11/12 rounded bg-white/[0.08]" />
            <div className="h-2 w-9/12 rounded bg-white/[0.08]" />
          </div>

          <div className="mt-5 flex gap-2">
            <div className="h-7 w-24 rounded-md bg-sky-500/80" />
            <div className="h-7 w-20 rounded-md border border-white/10 bg-white/5" />
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="aspect-square rounded-md bg-white/5" />
            <div className="aspect-square rounded-md bg-white/5" />
            <div className="aspect-square rounded-md bg-white/5" />
          </div>
        </div>
      </div>

      {/* Floating Riley-style chat bubble, lower-left, overlapping the browser */}
      <div className="absolute -bottom-6 -left-6 max-w-[220px] rounded-2xl rounded-bl-sm border border-white/10 bg-white px-4 py-3 text-sm text-neutral-900 shadow-xl shadow-black/30">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-sky-600">
          Riley
        </div>
        <div className="leading-snug">
          Hi! I can help you book a visit or request a quote.
        </div>
      </div>

      {/* Floating success card, upper-right, overlapping the browser */}
      <div className="absolute -top-5 -right-5 rounded-xl border border-white/10 bg-[#0f1419] px-4 py-3 shadow-xl shadow-black/30">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
            New Lead Captured
          </span>
        </div>
        <div className="mt-1 text-sm font-medium text-white/90">
          Booking requested
        </div>
        <div className="mt-0.5 text-xs text-white/50">
          From: yourbusiness.example
        </div>
      </div>
    </div>
  );
}