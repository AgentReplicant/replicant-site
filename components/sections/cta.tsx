"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CTA() {
  return (
    <section className="py-16 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"
      >
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#4E77FF]/20 to-[#00BDAA]/10">
          <div className="p-8 md:p-12">
            <h3 className="text-2xl md:text-3xl font-semibold">
              Ready to put bookings and sales on autopilot?
            </h3>
            <p className="mt-2 text-white/80 max-w-2xl">
              No scripts to write. No calendar ping-pong. We’ll qualify, book, and convert leads like
              your best rep.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-[#00BDAA] text-black hover:bg-[#05c79b]">
                <Link href="#get-started">Get Started</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/5">
                <Link href="#get-started">Book a Demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
