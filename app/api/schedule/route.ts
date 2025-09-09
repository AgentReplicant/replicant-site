// app/api/schedule/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { google, calendar_v3 } from "googleapis";
import sgMail from "@sendgrid/mail";

/* ----------------------------- ENV & CONSTANTS ---------------------------- */

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn("[schedule] SENDGRID_API_KEY not set — branded emails will be skipped.");
}

const FROM_EMAIL = "noreply@replicantapp.com"; // branded sender
const BCC_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";

// Either provide GOOGLE_REFRESH_TOKEN, or we will fetch it from Airtable row "Google OAuth"
const DIRECT_REFRESH = process.env.GOOGLE_REFRESH_TOKEN || "";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const AIRTABLE_TABLE = "Leads";
const AIRTABLE_NAME_FIELD = "Name";
const AIRTABLE_MSG_FIELD = "Message";

/* --------------------------------- HELPERS -------------------------------- */

// Accept ISO UTC with Z, with or without milliseconds.
function isIsoUtcZ(v?: string): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v);
}

// Only used for formatting human-facing text (not for API payloads)
function fmtInTz(isoUtcZ: string) {
  return new Date(isoUtcZ).toLocaleString("en-US", {
    timeZone: BOOKING_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

async function fetchRefreshFromAirtable(): Promise<string | null> {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) return null;
  try {
    const url =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}` +
      `?maxRecords=1&filterByFormula=${encodeURIComponent(`{${AIRTABLE_NAME_FIELD}}="Google OAuth"`)}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
      cache: "no-store",
    });
    const j = await r.json();
    const msg: string | undefined = j?.records?.[0]?.fields?.[AIRTABLE_MSG_FIELD];
    if (!msg) return null;
    try {
      const parsed = JSON.parse(msg);
      const token = parsed?.refresh_token;
      return typeof token === "string" ? token : null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

async function getRefreshToken(): Promise<string> {
  if (DIRECT_REFRESH) return DIRECT_REFRESH;
  const at = await fetchRefreshFromAirtable();
  if (at) return at;
  throw new Error(
    "Missing Google refresh token. Set GOOGLE_REFRESH_TOKEN or ensure Airtable row 'Google OAuth' contains it."
  );
}

function oauthClient(refreshToken: string) {
  const client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

/** Minimal ICS (UTC) */
function buildIcs(opts: {
  uid: string;
  startUtc: string;
  endUtc: string;
  title: string;
  description: string;
  meetLink?: string | null;
}) {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const toDt = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Replicant//Scheduling//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toDt(opts.startUtc)}`,
    `DTEND:${toDt(opts.endUtc)}`,
    `SUMMARY:${opts.title}`,
    `DESCRIPTION:${(opts.description || "").replace(/\r?\n/g, "\\n")}${opts.meetLink ? "\\n" + opts.meetLink : ""}`,
    opts.meetLink ? `URL:${opts.meetLink}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

async function sendConfirmationEmail(to: string, startUtc: string, endUtc: string, meetLink: string | null) {
  if (!SENDGRID_API_KEY) return;

  const startText = fmtInTz(startUtc);
  const endText = fmtInTz(endUtc);

  const ics = buildIcs({
    uid: `replicant-${Date.now()}`,
    startUtc,
    endUtc,
    title: "Replicant — Intro Call",
    description: "Booked via Replicant",
    meetLink: meetLink || undefined,
  });
  const icsB64 = Buffer.from(ics, "utf8").toString("base64");

  const msg: any = {
    personalizations: [
      {
        to: [{ email: to }],
        ...(BCC_EMAIL ? { bcc: [{ email: BCC_EMAIL }] } : {}),
      },
    ],
    from: { email: FROM_EMAIL, name: "Replicant" },
    subject: `Your Replicant consultation — ${startText}`,
    content: [
      {
        type: "text/plain",
        value:
          `You're booked!\n\n` +
          `When: ${startText} – ${endText}\n` +
          (meetLink ? `Meet link: ${meetLink}\n` : "") +
          `\nIf you need to reschedule, just reply to this email.`,
      },
    ],
    attachments: [
      {
        content: icsB64,
        type: "text/calendar",
        filename: "invite.ics",
        disposition: "attachment",
      },
    ],
  };

  await sgMail.send(msg);
}

/* ---------------------------------- ROUTE --------------------------------- */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      start?: string; // ISO with Z
      end?: string; // ISO with Z
      email?: string;
      summary?: string;
      description?: string;
    };

    if (!isIsoUtcZ(body.start) || !isIsoUtcZ(body.end) || !body.email) {
      return NextResponse.json(
        { error: "Required: start,end (ISO UTC with Z) and email" },
        { status: 400 }
      );
    }

    // Use RFC3339 UTC straight through (no local conversion; no timeZone on fields)
    const startUtc = body.start!;
    const endUtc = body.end!;

    // Auth
    const refresh = await getRefreshToken();
    const auth = oauthClient(refresh);
    const calendar = google.calendar({ version: "v3", auth });

    // Event
    const event: calendar_v3.Schema$Event = {
      summary: body.summary || "Replicant — Intro Call",
      description:
        body.description ||
        "Auto-booked from website chat. Times shown and scheduled in Eastern Time.",
      start: { dateTime: startUtc },
      end: { dateTime: endUtc },
      ...(body.email ? { attendees: [{ email: body.email }] } : {}),
      conferenceData: {
        createRequest: {
          requestId: `replicant-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const { data: ev } = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: event,
      sendUpdates: "all",
      conferenceDataVersion: 1,
    });

    const meetLink =
      ev?.hangoutLink ||
      ev?.conferenceData?.entryPoints?.find((p) => p?.entryPointType === "video")?.uri ||
      null;

    // Branded confirmation (noreply@replicantapp.com)
    await sendConfirmationEmail(body.email, startUtc, endUtc, meetLink);

    return NextResponse.json(
      { ok: true, eventId: ev?.id, htmlLink: ev?.htmlLink, meetLink },
      { status: 200 }
    );
  } catch (err: any) {
    const g = err?.response?.data;
    const message =
      g?.error?.message ||
      g?.error_description ||
      err?.message ||
      "Unknown scheduling error";
    return NextResponse.json({ error: message, google: g || null }, { status: 500 });
  }
}
