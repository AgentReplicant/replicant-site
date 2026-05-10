// app/page.tsx
import Hero from "@/components/sections/hero";
import Problem from "@/components/sections/problem";
import Categories from "@/components/sections/categories";
import { Features } from "@/components/sections/features";      // named export
import { HowItWorks } from "@/components/sections/howitworks";   // named export
import Pricing from "@/components/sections/pricing";
import AIAssistants from "@/components/sections/ai-assistants";
import GetStarted from "@/components/sections/get-started";
import FAQ from "@/components/sections/faq";
import Footer from "@/components/footer";

export default function HomePage() {
  return (
    <>
      <Hero />

      <section id="problem" className="py-10 md:py-24">
        <Problem />
      </section>

      <section id="websites" className="py-10 md:py-24">
        <Categories />
      </section>

      <section id="what-we-build" className="py-10 md:py-24">
        <Features />
      </section>

      <section id="how-it-works" className="py-10 md:py-24">
        <HowItWorks />
      </section>

      <section id="pricing" className="py-10 md:py-24">
        <Pricing />
      </section>

      <section id="ai-assistants" className="py-10 md:py-24">
        <AIAssistants />
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