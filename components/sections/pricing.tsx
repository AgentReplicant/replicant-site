// components/sections/pricing.tsx
"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Starter Website",
    price: "$750",
    blurb: "For simple service businesses that need a clean online presence.",
    features: [
      "Mobile-first website",
      "Services section",
      "Photos / gallery",
      "Contact form",
      "Booking or quote CTA",
      "Social links",
      "Basic SEO",
    ],
    cta: "Get a Free Website Audit",
    highlighted: false,
  },
  {
    name: "Booking / Quote Website",
    price: "$1,250",
    blurb: "For businesses that want a stronger conversion flow.",
    features: [
      "Everything in Starter",
      "Booking platform or quote form integration",
      "Reviews / testimonials",
      "Google Maps / location",
      "Better CTA structure",
      "Analytics setup",
    ],
    cta: "Get a Free Website Audit",
    highlighted: true,
  },
  {
    name: "Website + Replicant Assistant",
    price: "$2,000",
    priceSuffix: "setup + monthly support",
    blurb: "For businesses that want the site to answer questions, capture leads, and help customers take action.",
    features: [
      "Website",
      "AI assistant",
      "FAQ training",
      "Lead capture",
      "Booking / quote guidance",
      "Human handoff",
      "Conversation logs",
    ],
    cta: "Ask About Assistant Add-Ons",
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Pricing
        </h2>
        <p className="mt-3 text-white/70">
          Starting-at pricing. Final scope depends on your industry, content,
          and integrations — we’ll confirm in your free audit.
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {tiers.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            viewport={{ once: true }}
            className={`rounded-2xl border p-6 md:p-8 flex flex-col ${
              t.highlighted
                ? "border-sky-400/60 bg-sky-500/10 shadow-lg shadow-sky-500/10"
                : "border-white/10 bg-white/5"
            }`}
          >
            <div>
              <h3 className="text-xl font-semibold text-white">{t.name}</h3>
              <p className="mt-2 text-sm text-white/70">{t.blurb}</p>
              <div className="mt-4">
                <span className="text-xs text-white/60">Starting at</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl md:text-4xl font-bold text-white">
                    {t.price}
                  </span>
                  {t.priceSuffix && (
                    <span className="text-sm text-white/70">
                      {t.priceSuffix}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <ul className="mt-6 space-y-2 flex-1">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                  <Check className="h-4 w-4 mt-0.5 text-sky-400 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <a
              href="/get-started"
              className={`mt-8 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition w-full ${
                t.highlighted
                  ? "bg-sky-500 text-white hover:shadow-lg"
                  : "bg-slate-800/70 border border-slate-700 text-slate-100 hover:bg-slate-800"
              }`}
            >
              {t.cta}
            </a>
          </motion.div>
        ))}
      </div>
    </div>
  );
}