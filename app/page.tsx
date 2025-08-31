// app/page.tsx
import Hero from "@/components/sections/hero";
import { Features } from "@/components/sections/features";      // named export
import { HowItWorks } from "@/components/sections/howitworks";   // named export
import Pricing from "@/components/sections/pricing";
import GetStarted from "@/components/sections/get-started";
import FAQ from "@/components/sections/faq";
import Footer from "@/components/footer";

export default function HomePage() {
  return (
    <>
      <Hero />

      <section id="features" className="py-10 md:py-24">
        <Features />
      </section>

      <section id="how" className="py-10 md:py-24">
        <HowItWorks />
      </section>

      <section id="pricing" className="py-10 md:py-24">
        <Pricing />
      </section>

      {/* GetStarted renders its own <section id="get-started"> */}
      <GetStarted />

      <section id="faq" className="py-10 md:py-24">
        <FAQ />
      </section>

      <Footer />
    </>
  );
}
