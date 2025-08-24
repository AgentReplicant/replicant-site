import ChatWidget from "./ui/ChatWidget";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-10">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold">Replicant</h1>
        <p className="mt-3 text-slate-300">
          AI sales agent that qualifies leads and books directly on your calendar.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <a
            href="/api/google/oauth/start"
            className="rounded-xl bg-white/10 hover:bg-white/20 px-5 py-3 text-sm"
          >
            Book a call
          </a>
          <a
            href="[STRIPE_CHECKOUT_LINK]"
            className="rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-3 text-sm font-semibold"
          >
            Pay now (Setup + Monthly)
          </a>
        </div>
      </div>
      <ChatWidget />
    </main>
  );
}
