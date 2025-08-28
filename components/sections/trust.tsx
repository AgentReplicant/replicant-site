"use client";
import { motion } from "framer-motion";

export function Trust() {
  return (
    <section id="trust" className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid gap-10 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="rounded-3xl border border-white/10 bg-white/5 p-8"
        >
          <h3 className="text-2xl font-semibold">Built on platforms you already trust</h3>
          <p className="mt-3 text-white/70">OpenAI for language, Twilio for telephony, Stripe for payments, Vercel for hosting. Security, logging, and consent prompts by default.</p>
          <ul className="mt-6 space-y-2 text-white/80">
            <li>• PII awareness and redaction options</li>
            <li>• Opt-in/opt-out flows for recordings</li>
            <li>• Full transcripts + handoff history</li>
          </ul>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          viewport={{ once: true }}
          className="rounded-3xl border border-white/10 bg-white/5 p-8"
        >
          <h3 className="text-2xl font-semibold">What customers are saying</h3>
          <div className="mt-4 space-y-4">
            <blockquote className="rounded-xl border border-white/10 bg-black/30 p-4 text-white/80">
              “Booked 18 appointments the first week. The voice sounds human.”
              <div className="mt-2 text-sm text-white/50">— Placeholder, Local Services</div>
            </blockquote>
            <blockquote className="rounded-xl border border-white/10 bg-black/30 p-4 text-white/80">
              “Leads stopped ghosting. The agent follows up automatically.”
              <div className="mt-2 text-sm text-white/50">— Placeholder, Coaching</div>
            </blockquote>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
