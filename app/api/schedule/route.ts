// app/api/schedule/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { google, calendar_v3 } from "googleapis";
import sgMail from "@sendgrid/mail";

/* ----------------------------- ENV & CONSTANTS ---------------------------- */

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
if (SENDGRID_API_KEY) {
  try { sgMail.setApiKey(SENDGRID_API_KEY); } catch {}
} else {
  console.warn("[schedule] SENDGRID_API_KEY not set — branded emails will be skipped.");
}

const FROM_EMAIL = "noreply@replicantapp.com";
const BCC_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";

// Service Account (JSON) + impersonation user
const SA_JSON = process.env.GOOGLE_SA_JSON || "";
const SA_IMPERSONATE = process.env.GOOGLE_SA_IMPERSONATE || "";

/* --------------------------------- HELPERS -------------------------------- */

function requireEnv(name: string, val?: string) {
  if (!val) throw new Error(`Missing required env: ${name}`);
}

// Accept ISO UTC with Z, with or without milliseconds.
function isIsoUtcZ(v?: string): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v);
}

// Only for human-facing copy (not for API payloads)
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

/** Google Calendar client (SA + impersonation) — pass GoogleAuth (not getClient) to satisfy TS types */
async function getCalendar(): Promise<calendar_v3.Calendar> {
  requireEnv("GOOGLE_SA_JSON", SA_JSON);
  requireEnv("GOOGLE_SA_IMPERSONATE", SA_IMPERSONATE);

  const credentials = JSON.parse(SA_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    clientOptions: { subject: SA_IMPERSONATE },
    scopes: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
  });

  // Important: pass the GoogleAuth object itself (types accept this)
  return google.calendar({ version: "v3", auth }) as calendar_v3.Calendar;
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

/** Check if the calendar is free in [startUtc, endUtc) */
async function isFree(calendar: calendar_v3.Calendar, calendarId: string, startUtc: string, endUtc: string) {
  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: startUtc,
      timeMax: endUtc,
      timeZone: "UTC",
      items: [{ id: calendarId }],
    },
  });

  const cal = (data.calendars as any)?.[calendarId];
  const busy = cal?.busy ?? [];
  return !busy || busy.length === 0;
}

/* ---------------------------------- ROUTE --------------------------------- */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      start?: string; // ISO with Z
      end?: string;   // ISO with Z
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

    const startUtc = body.start!;
    const endUtc = body.end!;
    const attendeeEmail = body.email!;

    const calendar = await getCalendar();

    // Availability check (prevents stacking)
    try {
      const free = await isFree(calendar, CALENDAR_ID, startUtc, endUtc);
      if (!free) {
        return NextResponse.json(
          { error: "That time was just taken. Please pick another.", code: "SLOT_TAKEN" },
          { status: 409 }
        );
      }
    } catch (e: any) {
      const msg = e?.errors?.[0]?.message || e?.message || "freeBusy query failed";
      console.error("[schedule] freebusy error:", msg);
      return NextResponse.json(
        {
          error:
            "Availability check failed. Ensure the Service Account has domain-wide delegation for https://www.googleapis.com/auth/calendar.readonly.",
          google: msg,
        },
        { status: 500 }
      );
    }

    const event: calendar_v3.Schema$Event = {
      summary: body.summary || "Replicant — Intro Call",
      description:
        body.description ||
        "Auto-booked from website chat. Times shown and scheduled in Eastern Time.",
      start: { dateTime: startUtc },
      end: { dateTime: endUtc },
      attendees: [{ email: attendeeEmail }],
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

    await sendConfirmationEmail(attendeeEmail, startUtc, endUtc, meetLink);

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
