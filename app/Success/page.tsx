export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-10">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-4xl font-bold">Payment received ✅</h1>
        <p className="text-slate-300">Thanks for joining Replicant. Next steps:</p>
        <ol className="text-left space-y-2 text-slate-200">
          <li>1) Connect Google Calendar so we can book for you.</li>
          <li>2) Fill the onboarding form so we tailor the agent.</li>
        </ol>
        <div className="flex gap-3 justify-center pt-4">
          <a href="/api/google/oauth/start" className="rounded-xl bg-white/10 hover:bg-white/20 px-5 py-3 text-sm">
            Connect Google Calendar
          </a>
          <a href="/#lead" className="rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-3 text-sm font-semibold">
            Open onboarding form
          </a>
        </div>
      </div>
    </main>
  );
}
