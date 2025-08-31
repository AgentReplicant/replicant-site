// app/components/footer.tsx
"use client";

const STRIPE_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || "#";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/60">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h3 className="text-lg font-semibold">Ready to deploy your first agent?</h3>
            <p className="mt-1 text-sm opacity-80">
              Launch pricing: <span className="font-medium">$497 setup</span> +{" "}
              <span className="font-medium">$297/mo</span>. 14-day refund on the first month.
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href={STRIPE_LINK}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              Checkout
            </a>
            <a
              href="#get-started"
              className="inline-flex items-center rounded-lg border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/10"
            >
              Book a demo
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
