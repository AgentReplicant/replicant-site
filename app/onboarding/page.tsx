// app/onboarding/page.tsx
"use client";

import React, { useState } from "react";

export default function OnboardingPage() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Minimal, high-signal fields (expand later if needed)
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [website, setWebsite] = useState("");
  const [useCase, setUseCase] = useState<"Sales" | "Booking" | "Support" | "Mixed">("Mixed");
  const [channels, setChannels] = useState<string[]>(["Web"]);
  const [meetingType, setMeetingType] = useState<"Google Meet" | "Phone call">("Google Meet");
  const [notes, setNotes] = useState("");

  function toggleChannel(v: string) {
    setChannels((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        email,
        business,
        website,
        useCase,
        channels,       // ["Web","Instagram","WhatsApp","SMS"]
        meetingType,    // "Google Meet" | "Phone call"
        notes,
        // If you pass ?session_id=cs_test_... via Stripe success_url, we can forward it:
        stripeSessionId:
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("session_id") || undefined
            : undefined,
      };

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        throw new Error(j?.error || "Onboarding failed");
      }
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="max-w-2xl mx-auto p-6 text-slate-100">
        <h1 className="text-2xl font-semibold mb-2">Thanks — you’re in the queue!</h1>
        <p className="text-slate-300">
          We’ve received your setup details. A Replicant specialist will configure your agent and
          email you with next steps.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-6 text-slate-100">
      <h1 className="text-2xl font-semibold mb-2">Onboarding</h1>
      <p className="text-slate-300 mb-6">Tell us what to deploy — this goes straight to setup.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Your email *</label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.com"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Business name</label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            placeholder="Acme Co."
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Website / handle</label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="acme.com or @acme"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Primary use case</label>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            value={useCase}
            onChange={(e) => setUseCase(e.target.value as any)}
          >
            <option>Sales</option>
            <option>Booking</option>
            <option>Support</option>
            <option>Mixed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-2">Channels to launch</label>
          <div className="flex gap-3 flex-wrap text-sm">
            {["Web", "Instagram", "WhatsApp", "SMS"].map((c) => (
              <label key={c} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={channels.includes(c)}
                  onChange={() => toggleChannel(c)}
                />
                {c}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">Preferred meeting type</label>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            value={meetingType}
            onChange={(e) => setMeetingType(e.target.value as any)}
          >
            <option>Google Meet</option>
            <option>Phone call</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Anything else?</label>
          <textarea
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 min-h-[120px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Policies, FAQs, links, offer details…"
          />
        </div>

        {error && <div className="text-red-400 text-sm">{error}</div>}

        <button
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-blue-600 hover:bg-blue-500 transition px-4 py-2 disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Send"}
        </button>
      </div>
    </main>
  );
}
