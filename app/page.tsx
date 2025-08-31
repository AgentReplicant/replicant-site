// app/page.tsx
import Hero from "@/components/sections/hero";
import { Features } from "@/components/sections/features";
import { HowItWorks } from "@/components/sections/howitworks";
import Pricing from "@/components/sections/pricing";
import FAQ from "@/components/sections/faq";
import GetStarted from "@/components/sections/get-started";
import Footer from "@/components/footer"; // <-- fixed path

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

      {/* GetStarted already renders a section with id="get-started" internally */}
      <GetStarted />

      <section id="faq" className="py-10 md:py-24">
        <FAQ />
      </section>

      <Footer />
    </>
  );
}
