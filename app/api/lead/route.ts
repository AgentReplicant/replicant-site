// app/api/lead/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Simple in-memory rate limiter (per-IP + per-email).
 * Note: serverless instances are ephemeral; this still blocks burst bots well enough.
 */
const BUCKET = globalThis as unknown as {
  _rl?: Map<string, { t: number[] }>;
};
if (!BUCKET._rl) BUCKET._rl = new Map();
const RL = BUCKET._rl!;

function allow(id: string, limit: number, windowMs: number) {
  const now = Date.now();
  const arr = RL.get(id)?.t ?? [];
  const recent = arr.filter((t) => now - t < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  RL.set(id, { t: recent });
  return true;
}

function getClientIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/* ---------------- Airtable + SendGrid helpers ---------------- */

async function createAirtableLead(fields: Record<string, any>) {
  const base = process.env.AIRTABLE_BASE_ID!;
  const token = process.env.AIRTABLE_TOKEN!;
  const res = await fetch(`https://api.airtable.com/v0/${base}/Leads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  if (!res.ok) throw new Error(`Airtable error: ${await res.text()}`);
  return res.json();
}

async function maybeSendEmail(to: string | null, subject: string, text: string) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key || !to) return;
  try {
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'agentreplicant@gmail.com', name: 'Replicant' },
        subject,
        content: [{ type: 'text/plain', value: text }],
      }),
    });
  } catch (e) {
    console.warn('SendGrid notify skipped/error:', e);
  }
}

/* ---------------- Route handler ---------------- */

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // Soft rate-limits: 5/min per IP and 2/min per (IP+email)
    if (!allow(`ip:${ip}`, 5, 60_000)) {
      return NextResponse.json({ ok: true }, { status: 204 });
    }

    // Accept JSON or form-encoded bodies
    let body: any = {};
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      body = await req.json();
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      body = Object.fromEntries(form as any);
    } else {
      body = await req.json().catch(() => ({}));
    }

    const {
      name = '',
      email = '',
      phone = '',
      notes = '',
      // honeypot(s)
      hp = '',
      website = '',
      company = '',
      // canonical UTM fields (hidden inputs)
      utm_source = '',
      utm_medium = '',
      utm_campaign = '',
      utm_term = '',
      utm_content = '',
      // optional JSON bundle (back-compat)
      utm = '',
    } = body || {};

    // Honeypot: if any "bot bait" has content, do nothing (pretend success).
    if (hp || website || company) {
      return NextResponse.json({ ok: true }, { status: 204 });
    }

    // Per-email throttling (2/min)
    if (email) {
      if (!allow(`ip:${ip}:email:${email}`, 2, 60_000)) {
        return NextResponse.json({ ok: true }, { status: 204 });
      }
    }

    if (!name && !email) {
      return NextResponse.json({ ok: false, error: 'Missing name or email' }, { status: 400 });
    }

    // Build Message with UTM trail
    const utmParts: string[] = [];
    if (utm_source) utmParts.push(`source=${utm_source}`);
    if (utm_medium) utmParts.push(`medium=${utm_medium}`);
    if (utm_campaign) utmParts.push(`campaign=${utm_campaign}`);
    if (utm_term) utmParts.push(`term=${utm_term}`);
    if (utm_content) utmParts.push(`content=${utm_content}`);

    // Fall back to parsing JSON bundle if canonical fields were empty
    if (!utmParts.length && utm) {
      try {
        const j = typeof utm === 'string' ? JSON.parse(utm) : utm;
        if (j?.source) utmParts.push(`source=${j.source}`);
        if (j?.medium) utmParts.push(`medium=${j.medium}`);
        if (j?.campaign) utmParts.push(`campaign=${j.campaign}`);
        if (j?.term) utmParts.push(`term=${j.term}`);
        if (j?.content) utmParts.push(`content=${j.content}`);
      } catch {
        /* ignore bad JSON */
      }
    }

    const message = [notes || '', utmParts.length ? `UTM: ${utmParts.join(', ')}` : '']
      .filter(Boolean)
      .join('\n');

    // Write to Airtable (canonical fields)
    await createAirtableLead({
      Name: name || email || 'Unknown',
      Email: email || undefined,
      Phone: phone || undefined,
      Message: message || undefined,
      Source: 'Replicant site',
      Status: 'New',
    });

    // Optional admin email
    const admin = process.env.ADMIN_NOTIFY_EMAIL || '';
    await maybeSendEmail(
      admin || null,
      `Replicant: New Lead (${email || name || 'unknown'})`,
      [
        'New lead',
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone || '(none)'}`,
        `Notes: ${notes || '(none)'}`,
        utmParts.length ? `UTM: ${utmParts.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Lead route error:', err?.message || err);

    // 🔔 Best-effort email on 5xx (works on Vercel Hobby)
    try {
      const admin = process.env.ADMIN_NOTIFY_EMAIL || '';
      if (admin && process.env.SENDGRID_API_KEY) {
        await maybeSendEmail(
          admin,
          'ALERT: /api/lead failed (500)',
          [
            `Time: ${new Date().toISOString()}`,
            `Error: ${err?.message || String(err)}`,
          ].join('\n'),
        );
      }
    } catch {
      // ignore alert failures
    }

    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
