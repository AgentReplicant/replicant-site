// app/onboarding/page.tsx
"use client";
import { useState } from "react";

export default function OnboardingPage() {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setOk(null); setErr(null);
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    try {
      const r = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (r.ok && j?.ok) { setOk("Thanks — we’ve got everything we need."); e.currentTarget.reset(); }
      else setErr(j?.error || "Couldn’t save, try again.");
    } catch (e:any) {
      setErr(e?.message || "Network error");
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 text-slate-100">
      <h1 className="text-2xl font-semibold mb-6">Get your Replicant agent live</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <fieldset className="grid grid-cols-1 gap-4">
          <input name="businessName" placeholder="Business name" className="border rounded-lg px-3 py-2 bg-black/20 border-white/10" required />
          <input name="website" placeholder="Website (https://…)" className="border rounded-lg px-3 py-2 bg-black/20 border-white/10" />
          <input name="email" placeholder="Contact email" className="border rounded-lg px-3 py-2 bg-black/20 border-white/10" required />
          <input name="phone" placeholder="Contact phone" className="border rounded-lg px-3 py-2 bg-black/20 border-white/10" />
        </fieldset>

        <div className="space-y-2">
          <div className="font-medium">Agents to enable</div>
          <label className="flex items-center gap-2"><input type="checkbox" name="agentSupport" /> <span>Support</span></label>
          <label className="flex items-center gap-2"><input type="checkbox" name="agentBooking" /> <span>Booking</span></label>
          <label className="flex items-center gap-2"><input type="checkbox" name="agentSales" /> <span>Sales</span></label>
        </div>

        <div className="space-y-2">
          <div className="font-medium">Channels to start</div>
          <label className="flex items-center gap-2"><input type="checkbox" name="chanWeb" defaultChecked /> <span>Web chat</span></label>
          <label className="flex items-center gap-2"><input type="checkbox" name="chanInstagram" /> <span>Instagram (username)</span></label>
          <input name="instagramHandle" placeholder="@yourhandle" className="border rounded-lg px-3 py-2 bg-black/20 border-white/10" />
          <label className="flex items-center gap-2"><input type="checkbox" name="chanWhatsApp" /> <span>WhatsApp (number)</span></label>
          <input name="whatsAppNumber" placeholder="+1…" className="border rounded-lg px-3 py-2 bg-black/20 border-white/10" />
          <label className="flex items-center gap-2"><input type="checkbox" name="chanSMS" /> <span>SMS (number)</span></label>
          <input name="smsNumber" placeholder="+1…" className="border rounded-lg px-3 py-2 bg-black/20 border-white/10" />
        </div>

        <div className="space-y-2">
          <div className="font-medium">Booking (if enabled)</div>
          <select name="meetingType" className="border rounded-lg px-3 py-2 bg-black/20 border-white/10">
            <option value="video">Video (Google Meet)</option>
            <option value="phone">Phone call</option>
          </select>
          <textarea name="hoursNotes" placeholder="Hours/schedule rules (or 'same as website')" className="border rounded-lg px-3 py-2 bg-black/20 border-white/10" />
        </div>

        <div className="space-y-2">
          <div className="font-medium">Knowledge</div>
          <input name="faqsUrl" placeholder="Link to FAQs/policies" className="border rounded-lg px-3 py-2 bg-black/20 border-white/10" />
          <textarea name="faqsText" placeholder="Or paste FAQs here…" className="border rounded-lg px-3 py-2 bg-black/20 border-white/10" />
        </div>

        <textarea name="notes" placeholder="Anything else?" className="w-full border rounded-lg px-3 py-2 bg-black/20 border-white/10" />

        <button disabled={busy} className="bg-blue-600 rounded-lg px-4 py-2 disabled:opacity-60">
          {busy ? "Saving…" : "Submit"}
        </button>

        {ok && <div className="text-green-400 text-sm">{ok}</div>}
        {err && <div className="text-red-400 text-sm">{err}</div>}
      </form>
    </div>
  );
}
