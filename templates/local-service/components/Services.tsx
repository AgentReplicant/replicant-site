// templates/local-service/components/Services.tsx
//
// Grid of service cards. Each card shows title, description, optional price,
// and optional icon. The icon field is a short string (text or symbol) —
// example content omits it by default so the cards stay clean.

import type { ServiceItem } from "../types";

type Props = {
  services: ServiceItem[];
};

export function Services({ services }: Props) {
  if (!services || services.length === 0) return null;

  return (
    <section id="services" className="w-full bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
            Services
          </h2>
          <p className="mt-3 text-neutral-600">
            What we do — clear, priced where it makes sense.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <article
              key={`${s.title}-${i}`}
              className="rounded-lg border border-neutral-200 bg-white p-6 transition-shadow hover:shadow-md"
            >
              {s.icon && (
                <div className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--brand)]">
                  {s.icon}
                </div>
              )}
              <h3 className="text-lg font-semibold text-neutral-900">
                {s.title}
              </h3>
              <p className="mt-2 text-neutral-600">{s.desc}</p>
              {s.price && (
                <p className="mt-4 text-sm font-medium text-neutral-900">
                  {s.price}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}