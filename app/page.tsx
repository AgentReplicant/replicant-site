// app/page.tsx
import Hero from "@/components/sections/hero";
import { Features } from "@/components/sections/features";       // named export
import { HowItWorks } from "@/components/sections/howitworks";   // named export
import GetStarted from "@/components/sections/get-started";      // default export
import Footer from "@/components/footer";

export default function HomePage() {
  return (
    <>
      <Hero />

      <section id="features" className="py-10 md:py-24">
        <Features />
      </section>

      <section id="get-started" className="py-10 md:py-24">
        <GetStarted />
      </section>

      <section id="how" className="py-10 md:py-24">
        <HowItWorks />
      </section>

      <Footer />
    </>
  );
}
