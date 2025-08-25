"use client";
import { useState } from "react";

export default function LeadForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle"|"sending"|"ok"|"err">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, notes }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus("ok");
      setName(""); setEmail(""); setNotes("");
    } catch {
      setStatus("err");
    }
  }

  return (
    <form id="lead" onSubmit={onSubmit} className="bg-white/5 p-5 rounded-xl space-y-3 max-w-xl mx-auto">
      <h2 className="text-xl font-semibold">Onboarding Form</h2>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" className="w-full rounded-md p-2 bg-white/10 text-white" />
      <input value={email} onChange={e=>setEmail(e.target.value)} type="email" required placeholder="Email" className="w-full rounded-md p-2 bg-white/10 text-white" />
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Tell us about your business (optional)" className="w-full rounded-md p-2 bg-white/10 text-white min-h-[100px]" />
      <button disabled={status==="sending"} className="rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-3 text-sm font-semibold disabled:opacity-60">
        {status==="sending" ? "Submitting…" : "Submit"}
      </button>
      {status==="ok"  && <p className="text-green-300 text-sm">Thanks! We’ll reach out shortly.</p>}
      {status==="err" && <p className="text-red-300 text-sm">Something went wrong. Try again.</p>}
    </form>
  );
}
