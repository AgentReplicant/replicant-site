export default function Hero() {
  function tryDemo() {
    (window as any).replicantOpenChat?.();
    // belt + suspenders: also fire an event if the hook isn't set yet
    if (!(window as any).replicantOpenChat) {
      window.dispatchEvent(new Event("replicant:open-chat"));
    }
  }

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-5xl px-4 py-16 md:py-24">
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">
          AI Sales Agents That <span className="text-sky-400">Close Deals</span> For You
        </h1>
        <p className="mt-4 text-base md:text-lg opacity-80 max-w-2xl">
          Qualify, book, and convert across voice, SMS, and chat—without adding headcount.
        </p>

        <div className="mt-6 flex items-center gap-4">
          <a
            href="#get-started"
            className="inline-flex items-center rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-white/20"
          >
            Book a demo
          </a>

          <button
            onClick={tryDemo}
            className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-sky-500 focus:outline-none"
          >
            Try the live demo
          </button>
        </div>
      </div>
    </section>
  );
}
