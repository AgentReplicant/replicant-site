// templates/local-service/components/HowItWorks.tsx
//
// Numbered step list. Steps are sorted by the `step` field, so content can
// be written in any order. Brand color appears as the step-number background.

import type { HowItWorksStep } from "../types";

type Props = {
  steps: HowItWorksStep[];
};

export function HowItWorks({ steps }: Props) {
  if (!steps || steps.length === 0) return null;

  const sorted = [...steps].sort((a, b) => a.step - b.step);

  return (
    <section id="how" className="w-full bg-neutral-50 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
            How it works
          </h2>
          <p className="mt-3 text-neutral-600">
            Simple process, no surprises.
          </p>
        </div>

        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((s) => (
            <li
              key={`step-${s.step}`}
              className="rounded-lg border border-neutral-200 bg-white p-6"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-base font-semibold text-white">
                {s.step}
              </div>
              <h3 className="text-lg font-semibold text-neutral-900">
                {s.title}
              </h3>
              <p className="mt-2 text-neutral-600">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}