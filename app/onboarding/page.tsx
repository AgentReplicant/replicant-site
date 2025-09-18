// app/onboarding/page.tsx
import { Suspense } from "react";
import OnboardingClient from "./OnboardingClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
        <OnboardingClient />
      </Suspense>
    </div>
  );
}
