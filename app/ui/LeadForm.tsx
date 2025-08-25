"use client";

import { useState } from "react";

export default function LeadForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function isValidEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  }

  // very light permissive phone check; optional field
  function isValidPhone(v: string) {
    if (!v.trim()) return true; // optional
    const cleaned = v.replace(/[^\d+().\-\s]/g, "");
    return cleaned.length >= 7 && cleaned.length <= 20;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(false);

    if (!name.trim()) return setErr("Please enter your name.");
    if (!isValidEmail(email)) return setErr("Please enter a valid email.");
    if (!isValidPhone(phone)) return setErr("Please enter a valid phone (or leave it blank).");

    setSubmitting(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined, // optional
          notes: notes.trim() || "",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Request failed");
      }

      setOk(true);
      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
    } catch (e: any) {
      setErr(e?.message || "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 w-full max-w-2xl rounded-2xl bg-slate-900 p-6 shadow-xl ring-1 ring-slate-800">
      <h3 className="mb-4 text-lg font-semibold text-white">Onboarding Form</h3>

      <div className="space-y-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-md bg-slate-800 px-4 py-3 text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500"
        />

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-md bg-slate-800 px-4 py-3 text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500"
        />

        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (optional)"
          className="w-full rounded-md bg-slate-800 px-4 py-3 text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500"
        />

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Tell us about your business (optional)"
          rows={4}
          className="w-full rounded-md bg-slate-800 px-4 py-3 text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500"
        />

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>

        {ok && <p className="text-sm text-emerald-400">Thanks! We’ll reach out shortly.</p>}
        {err && <p className="text-sm text-rose-400">{err}</p>}
      </div>
    </form>
  );
}

