// app/success/page.tsx
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function SuccessPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-14 text-slate-100">
      <h1 className="text-2xl font-semibold mb-2">You're in 🎉</h1>
      <p className="text-slate-300">
        Payment received. Let’s grab the details we need to launch your Replicant agent.
      </p>

      <div className="mt-6">
        <Link
          href="/onboarding"
          className="inline-block bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded-lg"
        >
          Continue to onboarding →
        </Link>
      </div>

      <div className="mt-10 border-t border-white/10 pt-6 text-sm text-slate-400">
        <p>Questions? Open the chat and ask for a real person.</p>
      </div>
    </div>
  );
}
