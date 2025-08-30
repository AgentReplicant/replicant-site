export default function CTA() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-semibold">Ready to see it in action?</h2>
        <p className="mt-2 text-white/70">
          Tell us about your use case — we’ll reach out and get you set up.
        </p>

        <div className="mt-6">
          {/* Same-page anchor, not next/link */}
          <a href="#get-started">
            <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:opacity-90">
              Get Started
            </button>
          </a>
        </div>
      </div>
    </section>
  );
}
