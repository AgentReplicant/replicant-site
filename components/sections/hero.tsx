"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative pt-20 pb-16 md:pt-28 md:pb-24">
      {/* Glow ring */}
      <div className="absolute left-1/2 top-0 -z-10 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(78,119,255,0.30),transparent_60%)] blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid items-center gap-10 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00DBAA]" /> Live AI Agent • Bookings & Sales
          </span>

          <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            AI Sales Agents That <span className="bg-gradient-to-r from-[#4E77FF] to-[#00DBAA] bg-clip-text text-transparent">Close Deals</span> For You
          </h1>

          <p className="max-w-xl text-lg text-white/80">
            Replicant qualifies, books, and converts leads across voice, SMS, and chat — while you focus on fulfillment. No scripts to write. No calendar ping-pong.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {/* Primary flow: go to your existing lead form page */}
            <Button asChild size="lg" className="bg-[#00DBAA] text-black hover:bg-[#05c79b] shadow-[0_10px_30px_rgba(0,219,170,0.35)]">
              <Link href="/lead">Book a Demo</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
              <Link href="#features">See Features</Link>
            </Button>
          </div>

          <ul className="mt-4 flex flex-wrap gap-4 text-sm text-white/70">
            <li>• Powered by OpenAI + Stripe + Vercel</li>
            <li>• <span className="text-white">2–3s</span> response latency target</li>
            <li>• Voice & Omni-channel ready</li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true }}
          className="relative"
        >
          {/* Phone mock / gradient card */}
          <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-6 shadow-2xl">
            <div className="mb-4 text-sm text-white/70">Live call preview</div>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/80">Prospect</span>
                  <span className="text-white/50">00:23</span>
                </div>
                <div className="rounded-xl bg-white/5 p-3">“Hey, can you fit me in this Friday?”</div>
                <div className="rounded-xl bg-[#00DBAA] p-3 text-black">“Absolutely. I can do 2:30 PM or 4:15 PM — which works?”</div>
                <div className="rounded-xl bg-white/5 p-3">“Let’s do 4:15.”</div>
                <div className="rounded-xl bg-[#00DBAA] p-3 text-black">“Locked. I just texted your confirmation + directions.”</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
