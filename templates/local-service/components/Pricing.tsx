// templates/local-service/components/Pricing.tsx
//
// "Starting at" style pricing tiers. Display-only — no checkout, no add-to-cart.
// A tier can be visually emphasized via `highlighted: true` (renders with brand
// border + slight scale). Optional intro line sits above the grid.

import type { PricingContent } from "../types";

type Props = {
  pricing: PricingContent;
};

export function Pricing({ pricing }: Props) {
  if (!pricing || !pricing.tiers || pricing.tiers.length === 0) return null;

  return (
    <section id="pricing" className="w-full bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
            Pricing
          </h2>
          {pricing.intro && (
            <p className="mt-3 text-neutral-600">{pricing.intro}</p>
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pricing.tiers.map((tier, i) => {
            const baseClass =
              "flex flex-col rounded-lg border bg-white p-6 transition-shadow hover:shadow-md";
            const tierClass = tier.highlighted
              ? `${baseClass} border-[var(--brand)] shadow-sm`
              : `${baseClass} border-neutral-200`;

            return (
              <div key={`tier-${i}`} className={tierClass}>
                {tier.highlighted && (
                  <div className="mb-3 inline-flex w-fit items-center rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-white">
                    Most popular
                  </div>
                )}
                <h3 className="text-lg font-semibold text-neutral-900">
                  {tier.name}
                </h3>
                <p className="mt-2 text-2xl font-bold text-neutral-900">
                  {tier.price}
                </p>
                <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                  {tier.bullets.map((b, j) => (
                    <li key={`bullet-${i}-${j}`} className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]"
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}