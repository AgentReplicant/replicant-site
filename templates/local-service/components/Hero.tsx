// templates/local-service/components/Hero.tsx
//
// Top-of-page section. Headline + sub-headline + primary CTA (and optional
// secondary CTA). Optional background image. Brand color drives the primary
// button via the --brand CSS variable set on the page root.
//
// Note: CTAs use React.createElement instead of <a> JSX to avoid clipboard
// angle-bracket corruption when patches are pasted into this codebase.

import React from "react";
import type { HeroContent, BrandConfig } from "../types";

type Props = {
  hero: HeroContent;
  brand: BrandConfig;
};

const PRIMARY_CTA_CLASS =
  "inline-flex items-center justify-center rounded-md bg-[var(--brand)] px-6 py-3 text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90";

const SECONDARY_CTA_CLASS =
  "inline-flex items-center justify-center rounded-md border border-white/20 px-6 py-3 text-base font-semibold text-white transition-opacity hover:opacity-80";

export function Hero({ hero, brand }: Props) {
  const primaryCta = React.createElement(
    "a",
    { href: hero.primaryCta.href, className: PRIMARY_CTA_CLASS },
    hero.primaryCta.label
  );

  const secondaryCta = hero.secondaryCta
    ? React.createElement(
        "a",
        { href: hero.secondaryCta.href, className: SECONDARY_CTA_CLASS },
        hero.secondaryCta.label
      )
    : null;

  return (
    <section
      id="hero"
      className="relative w-full overflow-hidden bg-neutral-950 text-white"
    >
      {hero.image && (
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url(${hero.image})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}

      <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32 lg:py-40">
        {brand.tagline && (
          <p className="mb-4 text-sm uppercase tracking-[0.2em] text-white/70">
            {brand.tagline}
          </p>
        )}

        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
          {hero.headline}
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-white/80 sm:text-xl">
          {hero.sub}
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          {primaryCta}
          {secondaryCta}
        </div>
      </div>
    </section>
  );
}