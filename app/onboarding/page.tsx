// app/onboarding/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Channels = {
  Web: boolean;
  Instagram: boolean;
  WhatsApp: boolean;
  SMS: boolean;
};

export default function OnboardingPage() {
  const sp = useSearchParams();
  const sessionId = sp.get("session_id") || "";

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Basic form model
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [business, setBusiness] = useState("");
  const [website, setWebsite] = useState("");
  const [useCase, setUseCase] = useState<"Sales" | "Booking" | "Support" | "Other">("Sales");
  const [meetingType, setMeetingType] = useState<"Phone call" | "Google Meet">("Phone call");
  const [notes, setNotes] = useState("");
  const [channels, setChannels] = useState<Channels>({
    Web: true,
    Instagram: false,
    WhatsApp: false,
    SMS: false,
  });

  const channelsSelected = useMemo(
    () => Object.entries(channels).filter(([, v]) => v).map(([k]) => k),
    [channels]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        business: business.trim(),
        website: website.trim(), // optional OK
        useCase,
        channels: channelsSelected, // ["Web","Instagram",...]
        meetingType,
        notes: notes.trim(),
        stripeSessionId: sessionId || undefined,
      };

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await res.json().catch(() => ({} as any));
      if (res.ok && j?.ok) {
        setDone(true);
      } else {
        setError(j?.error || "Couldn’t save your details. Please try again.");
      }
    } catch (err: any) {
      setError(err?.message || "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-slate-100">
        <h1 className="text-2xl font-semibold mb-2">Thanks — you’re in the queue!</h1>
        <p className="text-slate-300">
          We’ve received your setup details. A Replicant specialist will configure your agent and
          email you with next steps.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-slate-100">
      {sessionId && (
        <div className="mb-6 rounded-xl border border-emerald-900/40 bg-emerald-900/20 p-4">
          <div className="text-emerald-300 text-sm font-medium">
            Thank you for your purchase!
          </div>
          <div className="text-slate-300 text-sm">
            To get your agent configured quickly, please share a few details below.
          </div>
        </div>
      )}

      <h1 className="text-xl font-semibold mb-1">Get your agent set up</h1>
      <p className="text-slate-300 mb-6">
        Tell us about your use case—this goes straight to the team.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-900/40 bg-rose-900/20 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Phone (optional)</label>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Business</label>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
              value={business}
              onChange={(e) => setBusiness(e.target.value)}
              placeholder="Demo Co"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Website (optional)</label>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://your-site.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">Primary use case</label>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
            value={useCase}
            onChange={(e) => setUseCase(e.target.value as any)}
          >
            <option>Sales</option>
            <option>Booking</option>
            <option>Support</option>
            <option>Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Channels (pick any)</label>
          <div className="flex flex-wrap gap-3 text-sm">
            {(["Web", "Instagram", "WhatsApp", "SMS"] as const).map((c) => (
              <label key={c} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={channels[c]}
                  onChange={() => setChannels((s) => ({ ...s, [c]: !s[c] }))}
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">If we need to talk, what do you prefer?</label>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
            value={meetingType}
            onChange={(e) => setMeetingType(e.target.value as any)}
          >
            <option>Phone call</option>
            <option>Google Meet</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Notes</label>
          <textarea
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything we should know? Policies, schedules, FAQs, typical objections…"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Send"}
        </button>
      </form>
    </div>
  );
}
