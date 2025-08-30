// app/components/sections/hero.tsx
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-[#0C1B2A] via-[#0C1B2A] to-transparent pb-20 pt-28 md:pt-36">
      <div className="mx-auto max-w-6xl px-4">
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
          AI Sales Agents That <span className="text-sky-400">Close Deals</span> For You
        </h1>

        <p className="mt-4 max-w-2xl text-slate-300">
          Qualify, book, and convert across voice, SMS, and chat—without adding headcount.
        </p>

        <div className="mt-8 flex items-center gap-4">
          <Link
            href="/#get-started"
            className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#0B0E12] shadow-md ring-1 ring-white/10 hover:bg-slate-100 active:scale-[0.99] transition"
          >
            Book a Demo
          </Link>

          <Link
            href="/#features"
            className="text-sm font-medium text-sky-400 underline-offset-4 hover:text-sky-300 hover:underline"
          >
            See Features
          </Link>
        </div>
      </div>
    </section>
  );
}
