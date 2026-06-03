// templates/local-service/components/Reviews.tsx
//
// Customer reviews grid. Rating is clamped to 0-5 and rendered as a star bar
// (no external icon library — just text). Reviews are static content, not a
// live feed; clients update them by editing content.ts.

import type { Review } from "../types";

type Props = {
  reviews: Review[];
};

function clampRating(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 5) return 5;
  return Math.round(n);
}

function Stars({ rating }: { rating: number }) {
  const filled = clampRating(rating);
  const empty = 5 - filled;
  // Using simple unicode stars; no icon library dependency.
  return (
    <div className="text-sm tracking-widest" aria-label={`${filled} out of 5 stars`}>
      <span className="text-[var(--brand)]">{"★".repeat(filled)}</span>
      <span className="text-neutral-300">{"★".repeat(empty)}</span>
    </div>
  );
}

export function Reviews({ reviews }: Props) {
  if (!reviews || reviews.length === 0) return null;

  return (
    <section id="reviews" className="w-full bg-neutral-50 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
            What customers say
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r, i) => (
            <blockquote
              key={`review-${i}`}
              className="rounded-lg border border-neutral-200 bg-white p-6"
            >
              <Stars rating={r.rating} />
              <p className="mt-3 text-neutral-800">&ldquo;{r.text}&rdquo;</p>
              <footer className="mt-4 text-sm font-medium text-neutral-900">
                — {r.name}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}