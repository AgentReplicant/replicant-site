// components/sections/pricing.tsx
export default function Pricing() {
  const checkout =
    (process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK as string | undefined) || "#";

  return (
    <div className="mx-auto max-w-5xl px-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 shadow-xl">
        <h2 className="text-2xl md:text-3xl font-semibold">Launch Pricing</h2>
        <p className="mt-2 text-slate-300">
          $497 setup + $297/mo. 14-day refund on the first month.
        </p>

        <div className="mt-6 grid gap-3 sm:flex">
          <a
            href={checkout}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-3 font-medium"
          >
            Checkout
          </a>
          <a
            href="#get-started"
            className="inline-flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 px-5 py-3"
          >
            Book a demo
          </a>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-300">
          <div className="rounded-xl bg-black/20 p-4">
            <div className="font-medium">Sales Agent</div>
            <div className="text-sm mt-1">Qualifies, handles objections, drops checkout.</div>
          </div>
          <div className="rounded-xl bg-black/20 p-4">
            <div className="font-medium">Support Agent</div>
            <div className="text-sm mt-1">Answers FAQs, collects info, escalates to you.</div>
          </div>
          <div className="rounded-xl bg-black/20 p-4">
            <div className="font-medium">Booking Agent</div>
            <div className="text-sm mt-1">Offers slots and books on your Google Calendar.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
