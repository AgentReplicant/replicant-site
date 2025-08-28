"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#4E77FF]/20 to-[#00DBAA]/20 p-8 md:p-12"
        >
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_60%)]" />
          <h3 className="text-2xl font-semibold md:text-3xl">Ready to put bookings and sales on autopilot?</h3>
          <p className="mt-2 max-w-2xl text-white/80">Launch an AI agent that talks like your brand and closes like your best rep.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-[#00DBAA] text-black hover:bg-[#05c79b]">
              <Link href="/lead">Get Started</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
              <Link href="/lead">Book a Demo</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
