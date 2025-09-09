// components/sections/hero.tsx
"use client";

import React from "react";

export default function Hero() {
  // Also dispatch a custom event for robustness
  const openChat = (e?: React.MouseEvent) => {
    e?.preventDefault?.();
    try {
      // hash support (so direct links work)
      if (location.hash !== "#chat") {
        history.replaceState(null, "", "#chat");
      }
      window.dispatchEvent(new Event("open-chat"));
    } catch {}
  };

  return (
    <section className="relative w-full pt-28 pb-24">
      <div className="mx-auto max-w-5xl px-6">
        <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight tracking-tight text-white">
          AI Sales Agents That <span className="text-sky-400">Close</span> Deals For You
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-2xl">
          Qualify, book, and convert across voice, SMS, and chat—without adding headcount.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {/* OPEN CHAT */}
          <a
            href="#chat"
            onClick={openChat}
            className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-4 py-2 text-white font-medium shadow hover:shadow-lg transition"
          >
            Try the live demo
          </a>

          {/* Keep the existing “Book a demo” CTA intact */}
          <a
            href="#get-started"
            className="inline-flex items-center justify-center rounded-lg bg-slate-800/70 border border-slate-700 px-4 py-2 text-slate-100 font-medium hover:bg-slate-800 transition"
          >
            Book a demo
          </a>
        </div>
      </div>
    </section>
  );
}
