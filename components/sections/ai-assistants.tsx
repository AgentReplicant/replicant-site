// components/sections/ai-assistants.tsx
"use client";

import { Bot } from "lucide-react";

export default function AIAssistants() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-sky-500/5 p-8 md:p-12">
        <div className="flex flex-col md:flex-row md:items-start md:gap-8">
          <div className="mb-6 md:mb-0">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#4E77FF] to-[#00DBAA]">
              <Bot className="h-6 w-6 text-black" />
            </div>
          </div>

          <div className="flex-1">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Add an Assistant When You’re Ready for the Website to Work Harder
            </h2>
            <p className="mt-4 text-white/70 max-w-2xl">
              Replicant assistants can answer common questions, capture lead
              details, guide customers toward booking or quote requests, and
              hand off to a real person when needed. It’s an upgrade to your
              site — not a replacement for it.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 max-w-2xl">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/80">
                Answer FAQs about services, pricing, and hours
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/80">
                Capture name, contact, and what the customer needs
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/80">
                Point customers to your booking link or quote form
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/80">
                Hand off to you when a real conversation is needed
              </div>
            </div>

            <div className="mt-8">
              <a
                href="/get-started"
                className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-4 py-2 text-white font-medium shadow hover:shadow-lg transition"
              >
                Ask About Assistant Add-Ons
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}