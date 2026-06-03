// templates/local-service/components/WhyChooseUs.tsx
//
// Simple 3-up reasons-to-pick-us section. Pure content cards, no images,
// no links. Brand color used only for the small indicator bar at the top
// of each card so the section reads as a clean professional grid.

import type { WhyChooseUsItem } from "../types";

type Props = {
  items: WhyChooseUsItem[];
};

export function WhyChooseUs({ items }: Props) {
  if (!items || items.length === 0) return null;

  return (
    <section id="why" className="w-full bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
            Why choose us
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={`why-${i}`}
              className="rounded-lg border border-neutral-200 bg-white p-6"
            >
              <div className="mb-4 h-1 w-10 rounded bg-[var(--brand)]" />
              <h3 className="text-lg font-semibold text-neutral-900">
                {item.title}
              </h3>
              <p className="mt-2 text-neutral-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}