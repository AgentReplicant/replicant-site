"use client";

import Navbar from "@/components/navbar";
import Hero from "@/components/sections/hero";
import CTA from "@/components/sections/cta";
import GetStarted from "@/components/sections/get-started";

// These files export **named** components
import { Logos } from "@/components/sections/logos";
import { Features } from "@/components/sections/features";
import { HowItWorks } from "@/components/sections/howitworks";
import { Trust } from "@/components/sections/trust";
import { Footer } from "@/components/footer";

export default function Page() {
  return (
    <main className="relative min-h-screen bg-[#0B1220] text-white overflow-x-clip">
      {/* Subtle gradient/texture */}
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(80%_60%_at_50%_-10%,rgba(78,119,255,.15),transparent)]" />

      <Navbar />
      <Hero />
      <Logos />
      <Features />
      <HowItWorks />
      <Trust />
      <CTA />

      {/* On-page form section */}
      <GetStarted />

      <Footer />
    </main>
  );
}
