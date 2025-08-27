import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** -----------------------------
 *  Simple in-memory rate limit
 *  ----------------------------- */
type Hit = { count: number; resetAt: number };
const ipHits = new Map<string, Hit>();
const RATE = { windowMs: 10 * 60 * 1000, max: 5 }; // 5 req / 10 min

function ipFrom(req: NextRequest) {
  const xf = req.headers.get('x-forwarded-for');
  return (xf?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown');
}
function checkRate(ip: string) {
  const now = Date.now();
  const rec = ipHits.get(ip);
  if (!rec || now > rec.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE.windowMs });
    return { allowed: true as const };
  }
  if (rec.count >= RATE.max) {
    return { allowed: false as const, retryAfter: Math.ceil((rec.resetAt - now) / 1000) };
  }
  rec.count += 1;
  return { allowed: true as const };
}

/** -----------------------------
 *  Helpers
 *  ----------------------------- */
async function sendGridNotify(to: string, subject: string, text: string) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key || !to) return;
  try {
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
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

async function airtableCreateLead({
  name,
  email,
  phone,
  message,
  source = 'Replicant site',
}: {
  name: string;
  email: string;
  phone?: string;
  message?: string;
  source?: string;
}) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId) throw new Error('Missing Airtable env');

  const res = await fetch(`https://api.airtable.com/v0/${baseId}/Leads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      records: [
        {
          fields: {
            Name: name,
            Email: email,
            Phone: phone || '',
            Message: message || '',
            Source: source,
          },
        },
      ],
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Airtable error ${res.status}: ${txt}`);
  }
}

/** -----------------------------
 *  Route handler
 *  ----------------------------- */
export async function POST(req: NextRequest) {
  try {
    // Rate limit
    const ip = ipFrom(req);
    const rate = checkRate(ip);
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
      );
    }

    // Read body (JSON or form)
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

    const { name, email, phone, notes, utm: utmJson, hp } = body || {};

    // Honeypot: if bots filled it, silently accept but do nothing
    if (typeof hp === 'string' && hp.trim().length > 0) {
      return NextResponse.json({ ok: true });
    }

    if (!name || !email) {
      return NextResponse.json({ ok: false, error: 'Missing name or email' }, { status: 400 });
    }

    // Append UTM info into the message (no schema changes needed)
    let utmText = '';
    if (utmJson) {
      try {
        const u = typeof utmJson === 'string' ? JSON.parse(utmJson) : utmJson;
        const parts = [
          u.source && `source=${u.source}`,
          u.medium && `medium=${u.medium}`,
          u.campaign && `campaign=${u.campaign}`,
          u.term && `term=${u.term}`,
          u.content && `content=${u.content}`,
        ].filter(Boolean);
        if (parts.length) utmText = `\nUTM: ${parts.join(', ')}`;
      } catch {
        /* ignore bad UTM JSON */
      }
    }
    const message: string = `${notes || ''}${utmText}`;

    // Create Airtable record (maps notes -> Message; Source fixed)
    await airtableCreateLead({ name, email, phone, message, source: 'Replicant site' });

    // Optional email to admin
    const admin = process.env.ADMIN_NOTIFY_EMAIL || '';
    if (admin) {
      await sendGridNotify(
        admin,
        `Replicant • New Lead ${email ? `(${email})` : ''}`,
        [
          'New lead',
          `Name: ${name}`,
          `Email: ${email}`,
          phone ? `Phone: ${phone}` : '',
          `Notes: ${notes || '(none)'}`,
          utmText ? utmText.trim() : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Lead route error:', err?.message || err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
