'use client';

import { useEffect, useState } from 'react';

export default function LeadForm() {
  // UTM state (canonical fields)
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmTerm, setUtmTerm] = useState('');
  const [utmContent, setUtmContent] = useState('');
  // JSON bundle (back-compat / convenience)
  const [utmJson, setUtmJson] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState<boolean | null>(null);

  // Collect UTM params from the URL and stash as both canonical fields AND JSON
  useEffect(() => {
    try {
      const p = new URL(window.location.href).searchParams;
      const utm = {
        source: p.get('utm_source') || '',
        medium: p.get('utm_medium') || '',
        campaign: p.get('utm_campaign') || '',
        term: p.get('utm_term') || '',
        content: p.get('utm_content') || '',
      };

      setUtmSource(utm.source);
      setUtmMedium(utm.medium);
      setUtmCampaign(utm.campaign);
      setUtmTerm(utm.term);
      setUtmContent(utm.content);

      if (Object.values(utm).some(Boolean)) {
        setUtmJson(JSON.stringify(utm));
      }
    } catch {
      /* no-op */
    }
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setOk(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload: Record<string, any> = Object.fromEntries(fd.entries());

    // Keep JSON bundle for back-compat (server also reads canonical utm_* fields)
    if (utmJson) payload.utm = utmJson;

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      setOk(res.ok && j?.ok !== false);
      if (res.ok) form.reset();
    } catch {
      setOk(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input
          name="name"
          required
          className="mt-1 w-full rounded-md border px-3 py-2 bg-white/5 border-white/10"
          placeholder="Jane Doe"
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input
          name="email"
          required
          type="email"
          className="mt-1 w-full rounded-md border px-3 py-2 bg-white/5 border-white/10"
          placeholder="jane@example.com"
        />
      </div>

      {/* Phone (optional) */}
      <div>
        <label className="block text-sm font-medium">Phone (optional)</label>
        <input
          name="phone"
          className="mt-1 w-full rounded-md border px-3 py-2 bg-white/5 border-white/10"
          placeholder="(555) 123-4567"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium">Notes</label>
        <textarea
          name="notes"
          rows={4}
          className="mt-1 w-full rounded-md border px-3 py-2 bg-white/5 border-white/10"
          placeholder="Tell us about your use case…"
        />
      </div>

      {/* Honeypot (bots will fill this; humans never see it) */}
      <input
        type="text"
        name="hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-5000px', height: 0, width: 0, opacity: 0 }}
      />

      {/* Canonical UTM fields (hidden) */}
      <input type="hidden" name="utm_source" value={utmSource} readOnly />
      <input type="hidden" name="utm_medium" value={utmMedium} readOnly />
      <input type="hidden" name="utm_campaign" value={utmCampaign} readOnly />
      <input type="hidden" name="utm_term" value={utmTerm} readOnly />
      <input type="hidden" name="utm_content" value={utmContent} readOnly />

      {/* UTM bundle (JSON) for back-compat / analytics */}
      <input type="hidden" name="utm" value={utmJson} readOnly />

      <button
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
        type="submit"
      >
        {submitting ? 'Sending…' : 'Send'}
      </button>

      {ok === true && (
        <p className="text-sm text-green-500">Thanks — we’ll reach out shortly.</p>
      )}
      {ok === false && (
        <p className="text-sm text-red-400">Whoops — please try again in a moment.</p>
      )}
    </form>
  );
}
