export default function CancelPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-10">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-3xl font-bold">Checkout canceled</h1>
        <p className="text-slate-300">No worries—pick up where you left off:</p>
        <a
          href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || "#"}
          className="rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-3 text-sm font-semibold"
        >
          Try checkout again
        </a>
      </div>
    </main>
  );
}
