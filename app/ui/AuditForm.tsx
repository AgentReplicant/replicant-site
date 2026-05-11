// app/ui/AuditForm.tsx
"use client";

import { useState } from "react";

type State = "idle" | "loading" | "success" | "error";

const CATEGORIES = [
  "Beauty & Grooming",
  "Wellness & Aesthetics",
  "Home & Trade Services",
  "Other",
];

const BOOKING_PLATFORMS = [
  "Booksy",
  "Square",
  "Calendly",
  "Acuity",
  "Fresha",
  "Other",
  "None",
];

const GOALS = [
  "More bookings",
  "More calls",
  "More quote requests",
  "More consultations",
  "Better online presence",
];

const TIMELINES = ["ASAP", "1–2 weeks", "This month", "Just exploring"];

const BUDGETS = [
  "Under $500",
  "$500–$1,000",
  "$1,000–$2,500",
  "$2,500+",
];

export default function AuditForm() {
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [bookingPlatform, setBookingPlatform] = useState("");
  const [goal, setGoal] = useState("");
  const [problem, setProblem] = useState("");
  const [timeline, setTimeline] = useState("");
  const [budget, setBudget] = useState("");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<State>("idle");

  const disabled = state === "loading";

  function buildMessage() {
    const lines: string[] = [];
    if (businessName) lines.push(`Business Name: ${businessName}`);
    if (category) lines.push(`Category: ${category}`);
    if (websiteUrl) lines.push(`Current Website: ${websiteUrl}`);
    if (socialUrl) lines.push(`Social: ${socialUrl}`);
    if (bookingPlatform) lines.push(`Booking Platform: ${bookingPlatform}`);
    if (goal) lines.push(`Main Goal: ${goal}`);
    if (problem) lines.push(`Main Problem: ${problem}`);
    if (timeline) lines.push(`Timeline: ${timeline}`);
    if (budget) lines.push(`Budget: ${budget}`);
    if (details) lines.push(`\nBusiness Details:\n${details}`);
    return lines.join("\n");
  }

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
          message: buildMessage(),
          source: "Website Audit",
          status: "Audit Request",
        }),
      });
      if (!res.ok) throw new Error("Bad response");
      setState("success");
      setName("");
      setBusinessName("");
      setEmail("");
      setPhone("");
      setCategory("");
      setWebsiteUrl("");
      setSocialUrl("");
      setBookingPlatform("");
      setGoal("");
      setProblem("");
      setTimeline("");
      setBudget("");
      setDetails("");
    } catch {
      setState("error");
    }
  }

  const inputClass =
    "mt-1.5 w-full rounded-lg bg-white/5 px-3 py-2.5 text-white placeholder-white/40 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-sky-500/60 transition";
  const labelClass = "text-sm text-slate-300";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          Name
          <input
            autoComplete="name"
            required
            className={inputClass}
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className={labelClass}>
          Business Name
          <input
            required
            className={inputClass}
            placeholder="Jane's Salon"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </label>

        <label className={labelClass}>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            className={inputClass}
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className={labelClass}>
          Phone
          <input
            autoComplete="tel"
            className={inputClass}
            placeholder="(555) 123-4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>

        <label className={labelClass}>
          Business Category
          <select
            required
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="" disabled>
              Select a category
            </option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Booking Platform
          <select
            className={inputClass}
            value={bookingPlatform}
            onChange={(e) => setBookingPlatform(e.target.value)}
          >
            <option value="">Select if applicable</option>
            {BOOKING_PLATFORMS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Current Website (optional)
          <input
            type="url"
            className={inputClass}
            placeholder="https://yourbusiness.com"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
          />
        </label>

        <label className={labelClass}>
          Instagram or Social Link (optional)
          <input
            type="url"
            className={inputClass}
            placeholder="https://instagram.com/yourhandle"
            value={socialUrl}
            onChange={(e) => setSocialUrl(e.target.value)}
          />
        </label>

        <label className={labelClass}>
          Main Goal
          <select
            required
            className={inputClass}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          >
            <option value="" disabled>
              What do you want more of?
            </option>
            {GOALS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Timeline
          <select
            className={inputClass}
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
          >
            <option value="">When are you looking to launch?</option>
            {TIMELINES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          Budget Range
          <select
            className={inputClass}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          >
            <option value="">Select a budget range</option>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          Main Problem
          <input
            className={inputClass}
            placeholder="What's the biggest issue with your current online presence?"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
          />
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          Business Details
          <textarea
            rows={5}
            className={inputClass}
            placeholder="Tell us about your business, current website, booking/quote flow, and what you want improved."
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </label>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex w-auto items-center rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-sky-500/20 ring-1 ring-sky-400/20 hover:bg-sky-400 hover:shadow-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99] transition"
        >
          {state === "loading" ? "Sending…" : "Request My Free Website Audit"}
        </button>
        {state === "success" && (
          <span className="text-sm text-emerald-400">
            Thanks — we'll review and reach out shortly.
          </span>
        )}
        {state === "error" && (
          <span className="text-sm text-rose-400">
            Something went wrong. Try again.
          </span>
        )}
      </div>
    </form>
  );
}