const STRIPE = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || "";

export default function Pricing() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-2xl border border-white/10 p-6 md:p-8 bg-black/30">
        <h3 className="text-2xl font-semibold">Launch pricing</h3>
        <p className="mt-2 text-slate-300">$497 setup + $297/mo. 14-day refund on first month.</p>

        <div className="mt-6">
          {STRIPE ? (
            <a
              href={STRIPE}
              target="_blank"
              rel="noopener"
              className="inline-block rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 font-medium"
            >
              Checkout
            </a>
          ) : (
            <span className="text-rose-400 text-sm">
              Set NEXT_PUBLIC_STRIPE_PAYMENT_LINK in Vercel to enable checkout.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
