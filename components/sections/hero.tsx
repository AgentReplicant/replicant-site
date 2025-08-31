export default function Hero() {
  return (
    <div className="mx-auto max-w-4xl py-16 md:py-24">
      <h1 className="text-4xl md:text-6xl font-bold">
        AI Sales Agents That <span className="text-sky-400">Close Deals</span> For You
      </h1>
      <p className="mt-4 text-slate-300">
        Qualify, book, and convert across voice, SMS, and chat—without adding headcount.
      </p>

      <div className="mt-8 flex gap-3">
        {/* Try live demo → opens chat via #chat */}
        <a href="#chat" className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 font-medium">
          Try the live demo
        </a>

        {/* Book a demo → scroll */}
        <a href="#get-started" className="rounded-lg bg-white/10 hover:bg-white/20 px-4 py-2 font-medium">
          Book a demo
        </a>
      </div>
    </div>
  );
}
