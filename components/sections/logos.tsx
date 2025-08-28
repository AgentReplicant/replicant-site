"use client";
import { motion } from "framer-motion";

export function Logos() {
  const items = ["OpenAI", "Stripe", "Vercel", "Twilio", "Google Cloud"];
  return (
    <section className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="flex flex-wrap items-center justify-center gap-6 text-white/60"
        >
          {items.map((name) => (
            <div
              key={name}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs"
            >
              Powered by {name}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
