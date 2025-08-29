// app/api/lead/route.ts
import { NextRequest, NextResponse } from 'next/server';

type AirtableCreateResp = { id?: string };

function fmtUtm(utm: any) {
  try {
    const u = typeof utm === 'string' ? JSON.parse(utm) : utm || {};
    const parts = [
      ['source', u.source],
      ['medium', u.medium],
      ['campaign', u.campaign],
      ['term', u.term],
      ['content', u.content],
    ]
      .filter(([, v]) => !!v)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    return parts ? `UTM: ${parts}` : '';
  } catch {
    return '';
  }
}

async function sendGridNotify(to: string, subject: string, text: string) {
  const key = process.env.SENDGRID_API_KEY || '';
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

export async function POST(req: NextRequest) {
  // --- Read body safely (never throw) ---
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const {
    name = '',
    email = '',
    phone = '',
    notes = '',
    utm = '',
    // honeypots
    hp = '',
    website = '',
    company = '',
  } = body || {};

  // --- HONEYPOT: bail out immediately with empty 204 ---
  if (hp || website || company) {
    console.log('Honeypot tripped for', email || '(no email)');
    return new NextResponse(null, { status: 204 });
  }

  try {
    // Build message (notes + UTM line if present)
    const utmLine = fmtUtm(utm);
    const message = [String(notes || '').trim(), utmLine].filter(Boolean).join('\n');

    // Create Airtable record (if creds present)
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || '';
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
    const canAirtable = AIRTABLE_TOKEN && AIRTABLE_BASE_ID;

    if (canAirtable) {
      const resp = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Leads`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: {
              Name: name,
              Email: email,
              Phone: phone || '',
              Message: message || '',
              Source: 'Replicant site', // matches your Single select option
              Status: 'New', // optional if you have it
            },
          }),
          // Airtable can return 422 for bad select values—let’s see the body if so
        }
      );

      if (!resp.ok) {
        const text = await resp.text();
        console.error('Airtable error:', resp.status, text);
        // Still return 200 to the client—this is a non-user error.
      } else {
        const j = (await resp.json()) as AirtableCreateResp;
        // Optional: j.id has the record id
      }
    } else {
      console.warn('Airtable creds missing; skipping create.');
    }

    // Optional admin email
    const admin = process.env.ADMIN_NOTIFY_EMAIL || '';
    if (admin) {
      await sendGridNotify(
        admin,
        `Replicant: New Lead (${email || 'unknown'})`,
        [
          'New lead',
          `Name: ${name}`,
          `Email: ${email}`,
          phone ? `Phone: ${phone}` : '',
          `Notes: ${notes || '(none)'}`,
          utmLine,
        ]
          .filter(Boolean)
          .join('\n')
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Lead route error:', err?.message || err);
    // Best-effort alert
    const admin = process.env.ADMIN_NOTIFY_EMAIL || '';
    if (admin) {
      await sendGridNotify(
        admin,
        'Replicant lead endpoint error',
        `Error: ${err?.message || String(err)}`
      );
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
