import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

import Hero from "@/components/sections/hero";
import { Logos } from "@/components/sections/logos";
import { Features } from "@/components/sections/features";
import { HowItWorks } from "@/components/sections/howitworks";
import { Trust } from "@/components/sections/trust";
import CTA from "@/components/sections/cta";
import GetStarted from "@/components/sections/get-started";

export default function Page() {
  return (
    <>
      <Navbar />
      <Hero />
      <Logos />
      <Features />
      <HowItWorks />
      <Trust />
      <CTA />
      <GetStarted />
      <Footer />
    </>
  );
}
