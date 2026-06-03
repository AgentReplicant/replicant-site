// templates/local-service/components/FAQ.tsx
//
// Accordion-style FAQ using native <details>/<summary>. No external library,
// no client-side state. Each question expands independently.

import type { FAQItem } from "../types";

type Props = {
  items: FAQItem[];
};

export function FAQ({ items }: Props) {
  if (!items || items.length === 0) return null;

  return (
    <section id="faq" className="w-full bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
            Frequently asked
          </h2>
        </div>

        <div className="divide-y divide-neutral-200 border-t border-b border-neutral-200">
          {items.map((item, i) => (
            <details
              key={`faq-${i}`}
              className="group py-5 marker:content-['']"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-left text-base font-medium text-neutral-900">
                <span>{item.q}</span>
                <span
                  aria-hidden
                  className="mt-1 inline-block h-5 w-5 shrink-0 text-[var(--brand)] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-neutral-700">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}