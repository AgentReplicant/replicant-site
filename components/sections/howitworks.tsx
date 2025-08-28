"use client";
import { motion } from "framer-motion";

const steps = [
  {
    k: "01",
    t: "Plug in your stack",
    d: "Connect calendar, Stripe payment link, and your lead form."
  },
  {
    k: "02",
    t: "Train with your FAQs",
    d: "Drop in policies, offers, and tone — the agent learns fast."
  },
  {
    k: "03",
    t: "Go live in days",
    d: "We monitor calls/messages, then tighten for conversion."
  }
];

export function HowItWorks() {
  return (
    <section id="how" className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">From setup to sales — fast</h2>
          <p className="mt-3 text-white/70">A simple rollout that respects your time and protects your brand voice.</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.k}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <div className="text-sm text-white/50">{s.k}</div>
              <div className="mt-2 text-xl font-semibold">{s.t}</div>
              <p className="mt-2 text-white/70">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
