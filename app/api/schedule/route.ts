import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AirtableRecord = { id: string; fields: Record<string, any> };

const AT_BASE = process.env.AIRTABLE_BASE_ID!;
const AT_TOKEN = process.env.AIRTABLE_TOKEN!;
const AT_HEADERS_JSON = {
  Authorization: `Bearer ${AT_TOKEN}`,
  'Content-Type': 'application/json',
};

async function getRefreshTokenFromAirtable() {
  const res = await fetch(
    `https://api.airtable.com/v0/${AT_BASE}/Leads?maxRecords=1&filterByFormula=${encodeURIComponent(
      `{Name}="Google OAuth"`
    )}`,
    { headers: { Authorization: `Bearer ${AT_TOKEN}` }, cache: 'no-store' }
  );
  const json = await res.json();
  const rec: AirtableRecord | undefined = json.records?.[0];
  if (!rec) return null;
  try {
    const msg = rec.fields.Message as string | undefined;
    if (!msg) return null;
    const parsed = JSON.parse(msg);
    return parsed.refresh_token as string | null;
  } catch {
    return null;
  }
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Failed to refresh access token: ${await res.text()}`);
  return (await res.json()) as { access_token: string; expires_in: number };
}

async function createCalendarEvent(
  accessToken: string,
  payload: {
    summary?: string;
    description?: string;
    start: string; // ISO
    end: string; // ISO
    attendeeEmail?: string;
  }
) {
  const tz = process.env.BOOKING_TZ || 'America/New_York';
  const calId = process.env.GOOGLE_CALENDAR_ID!;
  const requestId = 'req-' + Math.random().toString(36).slice(2);

  const body = {
    summary: payload.summary || 'Replicant Consultation',
    description: payload.description || 'Booked via Replicant',
    start: { dateTime: payload.start, timeZone: tz },
    end: { dateTime: payload.end, timeZone: tz },
    attendees: payload.attendeeEmail ? [{ email: payload.attendeeEmail }] : [],
    conferenceData: {
      createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } },
    },
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calId
    )}/events?conferenceDataVersion=1`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) throw new Error(`Create event failed: ${await res.text()}`);
  return res.json();
}

async function upsertAirtableAppointment(email: string | undefined, startISO: string) {
  if (!email) return;

  // IMPORTANT: double quotes in the filterByFormula
  const list = await fetch(
    `https://api.airtable.com/v0/${AT_BASE}/Leads?maxRecords=1&filterByFormula=${encodeURIComponent(
      `{Email}="${email}"`
    )}`,
    { headers: { Authorization: `Bearer ${AT_TOKEN}` }, cache: 'no-store' }
  ).then((r) => r.json());

  const fields = {
    Email: email,
    'Appointment Time': startISO,
    Status: 'Booked',
  };

  if (list.records?.[0]) {
    const rec: AirtableRecord = list.records[0];
    const res = await fetch(`https://api.airtable.com/v0/${AT_BASE}/Leads/${rec.id}`, {
      method: 'PATCH',
      headers: AT_HEADERS_JSON,
      body: JSON.stringify({ fields, typecast: true }), // typecast to allow "Booked"
    });
    if (!res.ok) {
      throw new Error(`Airtable PATCH failed: ${await res.text()}`);
    }
  } else {
    // If no existing lead for that email, create one
    const res = await fetch(`https://api.airtable.com/v0/${AT_BASE}/Leads`, {
      method: 'POST',
      headers: AT_HEADERS_JSON,
      body: JSON.stringify({
        records: [{ fields: { Name: email.split('@')[0], ...fields } }],
        typecast: true,
      }),
    });
    if (!res.ok) {
      throw new Error(`Airtable CREATE failed: ${await res.text()}`);
    }
  }
}

// --- Optional email helper (auto-skips if no SENDGRID_API_KEY) ---
async function maybeSendEmail(opts: { to?: string | null; subject: string; text: string }) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key || !opts.to) return;
  try {
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: opts.to }] }],
        from: { email: 'agentreplicant@gmail.com', name: 'Replicant' },
        subject: opts.subject,
        content: [{ type: 'text/plain', value: opts.text }],
      }),
    });
  } catch (e) {
    console.warn('SendGrid notify skipped/error:', e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { start, end, email, summary, description } = body;

    if (!start || !end) {
      return NextResponse.json({ ok: false, error: 'start and end (ISO) required' }, { status: 400 });
    }

    const refreshToken = await getRefreshTokenFromAirtable();
    if (!refreshToken) {
      return NextResponse.json(
        { ok: false, error: 'Google not connected. Visit /api/google/oauth/start first.' },
        { status: 400 }
      );
    }

    const { access_token } = await refreshAccessToken(refreshToken);
    const event = await createCalendarEvent(access_token, {
      start,
      end,
      attendeeEmail: email,
      summary,
      description,
    });

    // Upsert into Airtable
    await upsertAirtableAppointment(email, start);

    // --- Optional emails (admin + customer) ---
    const tz = process.env.BOOKING_TZ || 'America/New_York';
    const when = new Date(start).toLocaleString(tz, { timeZone: tz });
    const meetLink =
      event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri || null;

    await maybeSendEmail({
      to: process.env.ADMIN_NOTIFY_EMAIL,
      subject: 'Replicant — New booking',
      text: `Email: ${email || '(no email)'}\nWhen: ${when}\nMeet: ${meetLink || '(pending)'}\nEvent: ${event.htmlLink}`,
    });
    if (email) {
      await maybeSendEmail({
        to: email,
        subject: 'Your Replicant consultation is booked',
        text: `Thanks! You’re booked for ${when}.\nGoogle Meet: ${meetLink}\nEvent: ${event.htmlLink}`,
      });
    }
    // -----------------------------------------

    return NextResponse.json({
      ok: true,
      eventId: event.id,
      meetLink,
      htmlLink: event.htmlLink,
    });
  } catch (e: any) {
    console.error('schedule error:', e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}

// quick health check
export async function GET() {
  return NextResponse.json({ ok: true, connected: true });
}
