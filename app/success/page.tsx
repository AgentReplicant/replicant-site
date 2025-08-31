import Link from "next/link";

const ONBOARDING_URL = process.env.NEXT_PUBLIC_ONBOARDING_FORM_URL || "https://forms.gle/your-onboarding-form";

export default function SuccessPage() {
  return (
    <main className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-3xl font-bold mb-4">You’re in 🎉</h1>
      <p className="text-gray-600 mb-8">Next steps: connect your calendar and fill out onboarding.</p>
      <div className="flex gap-3">
        <Link
          href="/api/google/oauth/start"
          className="px-4 py-2 rounded-xl bg-black text-white"
        >
          Connect Calendar
        </Link>
        <a
          href={ONBOARDING_URL}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 rounded-xl border"
        >
          Open Onboarding Form
        </a>
      </div>
    </main>
  );
}
