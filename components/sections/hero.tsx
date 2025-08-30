import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* soft radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_100%_at_50%_0%,rgba(56,189,248,0.12),rgba(2,6,23,0))]" />
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
          AI Sales Agents That{" "}
          <span className="text-sky-400">Close Deals</span> For You
        </h1>

        <div className="mt-8 flex gap-4">
          <Link
            href="#get-started"
            className="inline-flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:opacity-90"
          >
            Book a Demo
          </Link>
          <Link href="#features" className="text-sky-400">
            See Features
          </Link>
        </div>
      </div>
    </section>
  );
}
