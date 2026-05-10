// components/footer.tsx
"use client";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/60">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h3 className="text-lg font-semibold">
              Ready to bring your service business online?
            </h3>
            <p className="mt-1 text-sm opacity-80">
              Free website audit. Starting at <span className="font-medium">$750</span>.
              Add a Replicant assistant when you’re ready.
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/get-started"
              className="inline-flex items-center rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium hover:shadow-lg transition"
            >
              Get a Free Website Audit
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center rounded-lg border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/10"
            >
              See Packages
            </a>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between text-xs opacity-70">
          <span>© {new Date().getFullYear()} Replicant. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <a href="/terms" className="hover:opacity-100">
              Terms
            </a>
            <a href="/privacy" className="hover:opacity-100">
              Privacy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}