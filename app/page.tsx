"use client";

import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/sections/hero";
import { Logos } from "@/components/sections/logos";
import { Features } from "@/components/sections/features";
import { HowItWorks } from "@/components/sections/howitworks";
import { Trust } from "@/components/sections/trust";
import { CTA } from "@/components/sections/cta";
import { Footer } from "@/components/footer";

export default function Page() {
  return (
    <main className="relative min-h-screen bg-[#0B1220] text-white overflow-x-clip">
      {/* Subtle gradient/texture background */}
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(80%_60%_at_50%_-10%,rgba(78,119,255,0.25),transparent_60%),radial-gradient(60%_50%_at_120%_0%,rgba(0,219,170,0.18),transparent_50%)]" />
      <Navbar />
      <Hero />
      <Logos />
      <Features />
      <HowItWorks />
      <Trust />
      <CTA />
      <Footer />
    </main>
  );
}
