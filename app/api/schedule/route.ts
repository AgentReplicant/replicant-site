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

// SA-based config (replaces legacy OAuth)
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";

const GOOGLE_SA_JSON = process.env.GOOGLE_SA_JSON!;
const GOOGLE_SA_IMPERSONATE = process.env.GOOGLE_SA_IMPERSONATE!;
const SEND_GOOGLE_INVITES = (process.env.SEND_GOOGLE_INVITES || "").toLowerCase() === "true";

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

/** Build a GoogleAuth (JWT) client for SA + domain-wide impersonation */
function getServiceAccountAuth(scopes: string[]) {
  const creds = JSON.parse(GOOGLE_SA_JSON);
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes,
    subject: GOOGLE_SA_IMPERSONATE, // impersonate Workspace user (noreply@replicantapp.com)
  });
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

    // Auth (Service Account + impersonation)
    const auth = getServiceAccountAuth([
      "https://www.googleapis.com/auth/calendar.events",
      // Add read scope if you also perform availability/freeBusy checks:
      // "https://www.googleapis.com/auth/calendar.readonly",
    ]);
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
      sendUpdates: SEND_GOOGLE_INVITES ? "all" : "none",
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
