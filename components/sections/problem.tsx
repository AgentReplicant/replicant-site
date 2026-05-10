// components/sections/problem.tsx
"use client";

import { motion } from "framer-motion";

const points = [
  "Customers shouldn't have to dig through social media to find your services.",
  "Your booking link, quote form, location, and contact info should be obvious.",
  "A real website gives people one clean place to trust you and take action.",
  "When you're ready, a Replicant assistant can answer questions and capture leads automatically.",
];

export default function Problem() {
  return (
    <section className="mx-auto max-w-5xl px-6">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
          Stop Losing Customers Between Interest and Action
        </h2>
        <p className="mt-4 text-white/65 leading-relaxed">
          Most service businesses lose customers in the gap between
          “interested” and “booked.” A real website closes that gap.
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {points.map((p, i) => (
          <motion.div
            key={p}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.05] hover:border-white/15 transition"
          >
            <p className="text-white/80 leading-relaxed">{p}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}