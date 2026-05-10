// components/sections/pricing.tsx
"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

type Tier = {
  name: string;
  price: string;
  priceSuffix?: string;
  blurb: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted: boolean;
};

const tiers: Tier[] = [
  {
    name: "Starter Site",
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
    ctaHref: "/website-audit",
    highlighted: false,
  },
  {
    name: "Booking / Quote Site",
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
    ctaHref: "/website-audit",
    highlighted: true,
  },
  {
    name: "Site + Assistant",
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
    ctaHref: "/get-started",
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <div className="mx-auto max-w-7xl px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
          Pricing
        </h2>
        <p className="mt-4 text-white/65 leading-relaxed">
          Starting-at pricing. Final scope depends on your industry, content,
          and integrations — we'll confirm in your free audit.
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3 lg:items-stretch">
        {tiers.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            viewport={{ once: true }}
            className={`relative ${t.highlighted ? "lg:-mt-2 lg:mb-2" : ""}`}
          >
            {t.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="inline-flex items-center rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-sky-500/30">
                  Recommended
                </span>
              </div>
            )}

            <div
              className={`h-full rounded-2xl border p-7 md:p-8 flex flex-col transition ${
                t.highlighted
                  ? "border-sky-400/40 bg-gradient-to-b from-sky-500/[0.08] to-white/[0.03] shadow-xl shadow-sky-500/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]"
              }`}
            >
              <div>
                <h3 className="text-xl font-semibold text-white">{t.name}</h3>
                <p className="mt-2 text-sm text-white/65 leading-relaxed">{t.blurb}</p>
                <div className="mt-5">
                  <span className="text-xs uppercase tracking-wider text-white/50">
                    Starting at
                  </span>
                  <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                    <span className="text-3xl md:text-4xl font-bold text-white">
                      {t.price}
                    </span>
                    {t.priceSuffix && (
                      <span className="text-sm text-white/65">
                        {t.priceSuffix}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <ul className="mt-7 space-y-2.5 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/80">
                    <Check className="h-4 w-4 mt-0.5 text-sky-400 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={t.ctaHref}
                className={`mt-8 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition w-full ${
                  t.highlighted
                    ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20 hover:bg-sky-400 hover:shadow-sky-500/30"
                    : "bg-white/5 border border-white/10 text-white/90 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                {t.cta}
              </a>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}