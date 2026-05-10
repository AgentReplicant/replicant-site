"use client";
import { motion } from "framer-motion";

const steps = [
  {
    k: "01",
    t: "Send Your Business Info",
    d: "Photos, services, booking links, service area, contact info, and anything customers need to know.",
  },
  {
    k: "02",
    t: "We Build the Website",
    d: "We create a clean, mobile-first site designed around your industry and your customer’s next step.",
  },
  {
    k: "03",
    t: "Review and Launch",
    d: "You review the site, request edits, and we connect your domain when it’s ready.",
  },
  {
    k: "04",
    t: "Upgrade When Ready",
    d: "Add a Replicant assistant to answer questions, capture lead details, and guide customers toward booking, calling, or requesting a quote.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            How It Works
          </h2>
          <p className="mt-3 text-white/70">
            A simple path from “I need a website” to a clean site your customers
            can actually use.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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