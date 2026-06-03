// templates/local-service/components/Gallery.tsx
//
// Two display modes:
//  - "grid"        : standard image grid (src + alt only)
//  - "beforeAfter" : pairs each item's `before` and `src` (after) side-by-side
//
// If items[] is empty, the section hides itself.
//
// Note: image paths come from content; this component does not validate that
// the files exist. Drop client photos into public/ before referencing them.

import type { GalleryContent } from "../types";

type Props = {
  gallery: GalleryContent;
};

export function Gallery({ gallery }: Props) {
  if (!gallery || !gallery.items || gallery.items.length === 0) return null;

  return (
    <section id="gallery" className="w-full bg-neutral-50 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
            {gallery.mode === "beforeAfter" ? "Before & After" : "Gallery"}
          </h2>
          <p className="mt-3 text-neutral-600">
            {gallery.mode === "beforeAfter"
              ? "Real work, side by side."
              : "A look at recent work."}
          </p>
        </div>

        {gallery.mode === "beforeAfter" ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.items.map((item, i) => (
              <figure
                key={`ba-${i}`}
                className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
              >
                <div className="grid grid-cols-2 gap-0">
                  <div className="relative aspect-square bg-neutral-100">
                    {item.before && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.before}
                        alt={`${item.alt} — before`}
                        className="h-full w-full object-cover"
                      />
                    )}
                    <span className="absolute left-2 top-2 rounded bg-neutral-900/70 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-white">
                      Before
                    </span>
                  </div>
                  <div className="relative aspect-square bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.src}
                      alt={`${item.alt} — after`}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-2 top-2 rounded bg-[var(--brand)] px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-white">
                      After
                    </span>
                  </div>
                </div>
                {item.alt && (
                  <figcaption className="px-4 py-3 text-sm text-neutral-600">
                    {item.alt}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.items.map((item, i) => (
              <figure
                key={`g-${i}`}
                className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
              >
                <div className="relative aspect-square bg-neutral-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.src}
                    alt={item.alt}
                    className="h-full w-full object-cover"
                  />
                </div>
                {item.alt && (
                  <figcaption className="px-4 py-3 text-sm text-neutral-600">
                    {item.alt}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}