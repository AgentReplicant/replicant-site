// app/ui/LeadForm.tsx
"use client";

import { useState } from "react";

type State = "idle" | "loading" | "success" | "error";

export default function LeadForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<State>("idle");
  const disabled = state === "loading";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          message,
          source: "Replicant site",
        }),
      });
      if (!res.ok) throw new Error("Bad response");
      setState("success");
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch {
      setState("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5">
        <label className="text-sm text-slate-300">
          Name
          <input
            autoComplete="name"
            required
            className="mt-1.5 w-full rounded-lg bg-white/5 px-3 py-2.5 text-white placeholder-white/40 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-sky-500/60 transition"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="text-sm text-slate-300">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            className="mt-1.5 w-full rounded-lg bg-white/5 px-3 py-2.5 text-white placeholder-white/40 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-sky-500/60 transition"
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="text-sm text-slate-300">
          Phone (optional)
          <input
            autoComplete="tel"
            className="mt-1.5 w-full rounded-lg bg-white/5 px-3 py-2.5 text-white placeholder-white/40 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-sky-500/60 transition"
            placeholder="(555) 123-4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>

        <label className="text-sm text-slate-300">
          Business Details
          <textarea
            rows={5}
            className="mt-1.5 w-full rounded-lg bg-white/5 px-3 py-2.5 text-white placeholder-white/40 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-sky-500/60 transition"
            placeholder="Tell us about your business, current website, booking/quote flow, and what you want improved."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex w-auto items-center rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-sky-500/20 ring-1 ring-sky-400/20 hover:bg-sky-400 hover:shadow-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99] transition"
        >
          {state === "loading" ? "Sending…" : "Request Audit"}
        </button>
        {state === "success" && (
          <span className="text-sm text-emerald-400">Thanks — we'll reach out.</span>
        )}
        {state === "error" && (
          <span className="text-sm text-rose-400">Something went wrong. Try again.</span>
        )}
      </div>
    </form>
  );
}