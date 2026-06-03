// templates/local-service/TemplatePage.tsx
//
// Top-level template page. Sets the --brand CSS variable on the root element,
// then composes all section components in order from a single LocalServiceContent
// object.
//
// NOT a Next.js route — this directory sits outside app/. When building a real
// client site, copy this component's body into a new project's app/page.tsx.
// See README.md for the full instantiation walkthrough.

import React from "react";
import type { LocalServiceContent } from "./types";
import { Hero } from "./components/Hero";
import { Services } from "./components/Services";
import { Gallery } from "./components/Gallery";
import { WhyChooseUs } from "./components/WhyChooseUs";
import { HowItWorks } from "./components/HowItWorks";
import { Pricing } from "./components/Pricing";
import { Reviews } from "./components/Reviews";
import { FAQ } from "./components/FAQ";
import { Contact } from "./components/Contact";

type Props = {
  content: LocalServiceContent;
};

export function TemplatePage({ content }: Props) {
  // Set --brand at the page root so every section that uses bg-[var(--brand)]
  // or text-[var(--brand)] picks up the client's color.
  const rootStyle = { ["--brand" as string]: content.brand.primaryColor } as React.CSSProperties;

  return (
    <main style={rootStyle} className="bg-white text-neutral-900">
      <Hero hero={content.hero} brand={content.brand} />
      <Services services={content.services} />
      {content.gallery && <Gallery gallery={content.gallery} />}
      {content.whyChooseUs && <WhyChooseUs items={content.whyChooseUs} />}
      {content.howItWorks && <HowItWorks steps={content.howItWorks} />}
      {content.pricing && <Pricing pricing={content.pricing} />}
      {content.reviews && <Reviews reviews={content.reviews} />}
      {content.faq && <FAQ items={content.faq} />}
      <Contact contact={content.contact} socials={content.socials} />
    </main>
  );
}