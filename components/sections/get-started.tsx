// components/sections/get-started.tsx
export default function GetStartedSection() {
  return (
    <section id="get-started" className="py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Ready to bring your service business online?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/65 md:text-base">
          Start with a free website audit. Answer a few quick questions and we
          will review your business, current online presence, and the easiest
          path to more bookings, calls, or quote requests.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="/website-audit"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-sky-500/20 ring-1 ring-sky-400/20 transition hover:bg-sky-400 hover:shadow-sky-500/30"
          >
            Start Free Website Audit
          </a>
          <a
            href="#pricing"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white"
          >
            See Packages
          </a>
        </div>
      </div>
    </section>
  );
}
