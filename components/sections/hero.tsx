"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Hero() {
  return (
    <section className="relative pt-20 pb-16 md:pt-28 md:pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid items-center gap-10 md:grid-cols-2">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00BDAA]" />
              Live AI Agent • Bookings & Sales
            </span>

            <h1 className="mt-6 text-4xl md:text-6xl font-semibold leading-tight">
              AI Sales Agents That{" "}
              <span className="bg-gradient-to-r from-[#4E77FF] to-[#00BDAA] bg-clip-text text-transparent">
                Close Deals
              </span>{" "}
              For You
            </h1>

            <p className="mt-6 text-white/80">
              Replicant qualifies, books, and converts leads across voice, SMS, and chat — while you
              focus on fulfillment. No scripts to write. No calendar ping-pong.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="bg-[#00BDAA] text-black hover:bg-[#05c79b]">
                <Link href="#get-started">Book a Demo</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/5">
                <Link href="#features">See Features</Link>
              </Button>
            </div>

            <ul className="mt-4 flex flex-wrap gap-4 text-sm text-white/70">
              <li>• Powered by OpenAI + Stripe + Vercel</li>
              <li>• <span className="text-white">2–3s</span> response latency target</li>
              <li>• Voice & Omni-channel ready</li>
            </ul>
          </motion.div>
        </div>

        {/* right side mock left as-is */}
        <div className="relative">
          {/* … your existing phone/chat preview content … */}
        </div>
      </div>
    </section>
  );
}
