"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type FormState = {
  email: string;
  business: string;
  website: string;
  useCase: "Sales" | "Booking" | "Support";
  channels: { web: boolean; instagram: boolean; sms: boolean; whatsapp: boolean };
  meetingType: "Google Meet" | "Phone call";
  notes: string;
};

const initialState: FormState = {
  email: "",
  business: "",
  website: "",
  useCase: "Sales",
  channels: { web: true, instagram: false, sms: false, whatsapp: false },
  meetingType: "Google Meet",
  notes: "",
};

export default function OnboardingClient() {
  const sp = useSearchParams();
  const sessionId = useMemo(() => sp.get("session_id") || "", [sp]);
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const channels: string[] = [];
      if (form.channels.web) channels.push("Web");
      if (form.channels.instagram) channels.push("Instagram");
      if (form.channels.sms) channels.push("SMS");
      if (form.channels.whatsapp) channels.push("WhatsApp");

      const payload = {
        email: form.email.trim(),
        business: form.business.trim(),
        website: form.website.trim(), // optional
        useCase: form.useCase,
        channelsWanted: channels,
        meetingType: form.meetingType,
        notes: form.notes.trim(),
        stripeSessionId: sessionId || undefined,
      };

      const r = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({} as any));

      if (!r.ok || j?.ok === false) {
        throw new Error(j?.error || "Failed to submit details");
      }

      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Thank-you banner always visible */}
      <div>
        <h1 className="text-2xl font-semibold text-white mb-2">Thanks — you’re in the queue!</h1>
        <p className="text-slate-300">
          We’ve received your order. To get your agent configured quickly, please share a few setup details below.
        </p>
      </div>

      {/* Success state */}
      {done ? (
        <div className="rounded-xl border border-emerald-300/30 bg-emerald-900/20 text-emerald-100 p-4">
          <div className="font-medium mb-1">Got it — thanks!</div>
          <div>
            A Replicant specialist will configure your agent and email you with next steps.
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
          {error && (
            <div className="rounded-md border border-red-400/40 bg-red-900/20 text-red-100 px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {/* Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm">
              <div className="mb-1 text-slate-200">Email</div>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-md border border-white/10 bg-white text-slate-900 px-3 py-2"
                placeholder="you@company.com"
              />
            </label>
            <label className="text-sm">
              <div className="mb-1 text-slate-200">Business name</div>
              <input
                required
                value={form.business}
                onChange={(e) => setForm({ ...form, business: e.target.value })}
                className="w-full rounded-md border border-white/10 bg-white text-slate-900 px-3 py-2"
                placeholder="Acme Co"
              />
            </label>
          </div>

          <label className="text-sm block">
            <div className="mb-1 text-slate-200">Website (optional)</div>
            <input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="w-full rounded-md border border-white/10 bg-white text-slate-900 px-3 py-2"
              placeholder="https://example.com"
            />
          </label>

          {/* Use case */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm block">
              <div className="mb-1 text-slate-200">Primary use case</div>
              <select
                value={form.useCase}
                onChange={(e) => setForm({ ...form, useCase: e.target.value as FormState["useCase"] })}
                className="w-full rounded-md border border-white/10 bg-white text-slate-900 px-3 py-2"
              >
                <option>Sales</option>
                <option>Booking</option>
                <option>Support</option>
              </select>
            </label>

            <label className="text-sm block">
              <div className="mb-1 text-slate-200">Meeting preference</div>
              <select
                value={form.meetingType}
                onChange={(e) => setForm({ ...form, meetingType: e.target.value as FormState["meetingType"] })}
                className="w-full rounded-md border border-white/10 bg-white text-slate-900 px-3 py-2"
              >
                <option>Google Meet</option>
                <option>Phone call</option>
              </select>
            </label>
          </div>

          {/* Channels */}
          <fieldset className="text-sm">
            <legend className="mb-1 text-slate-200">Channels you want (pick all that apply)</legend>
            <div className="flex flex-wrap gap-4">
              {([
                ["web", "Web"],
                ["instagram", "Instagram"],
                ["sms", "SMS"],
                ["whatsapp", "WhatsApp"],
              ] as const).map(([key, label]) => (
                <label key={key} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.channels[key]}
                    onChange={(e) =>
                      setForm({ ...form, channels: { ...form.channels, [key]: e.target.checked } })
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="text-sm block">
            <div className="mb-1 text-slate-200">Notes (anything that helps us configure your agent)</div>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-md border border-white/10 bg-white text-slate-900 px-3 py-2"
              placeholder="Hours, offers, FAQs, tone, etc."
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-white text-slate-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Send setup details"}
          </button>

          {/* Hidden session id display for transparency */}
          {sessionId && (
            <div className="text-[11px] text-slate-400 mt-2">
              Linked to session: <span className="font-mono">{sessionId}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
