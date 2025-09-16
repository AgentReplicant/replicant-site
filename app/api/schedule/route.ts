// app/api/schedule/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { google, calendar_v3 } from "googleapis";

// ---- ENV
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";
const SA_JSON = process.env.GOOGLE_SA_JSON || "";
const SA_IMPERSONATE = process.env.GOOGLE_SA_IMPERSONATE || "";

// Optional: only if you *really* want ICS alongside Google native invites
const SEND_CONFIRM_ICS = process.env.SEND_CONFIRM_ICS === "1";
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = "noreply@replicantapp.com";
const BCC_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "";

// Lead-time (server authority)
const LEAD_MINUTES = Number(process.env.SLOTS_LEAD_MINUTES || process.env.BOOKING_LEAD_MINUTES || 60);

// ---- Helpers
function requireEnv(name: string, val?: string) {
  if (!val) throw new Error(`Missing required env: ${name}`);
}
function isIsoUtcZ(v?: string): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v);
}
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
  return google.calendar({ version: "v3", auth }) as calendar_v3.Calendar;
}
async function isFree(calendar: calendar_v3.Calendar, calendarId: string, startUtc: string, endUtc: string) {
  const { data } = await calendar.freebusy.query({
    requestBody: { timeMin: startUtc, timeMax: endUtc, timeZone: "UTC", items: [{ id: calendarId }] },
  });
  const cal = (data.calendars as any)?.[calendarId];
  const busy = cal?.busy ?? [];
  return !busy || busy.length === 0;
}

// Minimal ICS (only if enabled)
function buildIcs(opts: { uid: string; startUtc: string; endUtc: string; title: string; description: string; meetLink?: string | null; }) {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const toDt = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Replicant//Scheduling//EN","CALSCALE:GREGORIAN","METHOD:REQUEST","BEGIN:VEVENT",
    `UID:${opts.uid}`,`DTSTAMP:${dtstamp}`,`DTSTART:${toDt(opts.startUtc)}`,`DTEND:${toDt(opts.endUtc)}`,
    `SUMMARY:${opts.title}`,`DESCRIPTION:${(opts.description || "").replace(/\r?\n/g, "\\n")}${opts.meetLink ? "\\n" + opts.meetLink : ""}`,
    opts.meetLink ? `URL:${opts.meetLink}` : "","END:VEVENT","END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { start?: string; end?: string; email?: string; summary?: string; description?: string; };

    if (!isIsoUtcZ(body.start) || !isIsoUtcZ(body.end) || !body.email) {
      return NextResponse.json({ error: "Required: start,end (ISO UTC with Z) and email" }, { status: 400 });
    }

    const startUtc = body.start!;
    const endUtc = body.end!;
    const attendeeEmail = body.email!;

    // Lead-time enforcement (server authority)
    const cutoff = Date.now() + LEAD_MINUTES * 60_000;
    if (new Date(startUtc).getTime() < cutoff) {
      return NextResponse.json({ error: `Earliest bookable time is +${LEAD_MINUTES} minutes from now.`, code: "LEAD_WINDOW" }, { status: 409 });
    }

    const calendar = await getCalendar();

    // Availability check
    try {
      const free = await isFree(calendar, CALENDAR_ID, startUtc, endUtc);
      if (!free) {
        return NextResponse.json({ error: "That time was just taken. Please pick another.", code: "SLOT_TAKEN" }, { status: 409 });
      }
    } catch (e: any) {
      const msg = e?.errors?.[0]?.message || e?.message || "freeBusy query failed";
      console.error("[schedule] freebusy error:", msg);
      return NextResponse.json({ error: "Availability check failed. Verify DWD scopes for calendar.readonly.", google: msg }, { status: 500 });
    }

    const event: calendar_v3.Schema$Event = {
      summary: body.summary || "Replicant — Intro Call",
      description: body.description || "Auto-booked from chat. Times shown/scheduled in ET.",
      start: { dateTime: startUtc },
      end: { dateTime: endUtc },
      attendees: [{ email: attendeeEmail }],
      conferenceData: {
        createRequest: { requestId: `replicant-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } },
      },
    };

    const { data: ev } = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: event,
      sendUpdates: "all",            // native Google invites
      conferenceDataVersion: 1,
    });

    const meetLink =
      ev?.hangoutLink ||
      ev?.conferenceData?.entryPoints?.find((p) => p?.entryPointType === "video")?.uri ||
      null;

    // Optional ICS — OFF by default to avoid duplicate invites
    if (SEND_CONFIRM_ICS && SENDGRID_API_KEY && attendeeEmail) {
      try {
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
        await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: attendeeEmail }], ...(BCC_EMAIL ? { bcc: [{ email: BCC_EMAIL }] } : {}) }],
            from: { email: FROM_EMAIL, name: "Replicant" },
            subject: `Your Replicant consultation — ${startText}`,
            content: [{ type: "text/plain", value: `You're booked!\n\nWhen: ${startText} – ${endText}\n${meetLink ? `Meet: ${meetLink}\n` : ""}` }],
            attachments: [{ content: icsB64, type: "text/calendar", filename: "invite.ics", disposition: "attachment" }],
          }),
        });
      } catch (e) {
        console.warn("[schedule] sendgrid optional email skipped:", (e as any)?.message || e);
      }
    }

    // Friendly “when” for the chat confirmation
    const when = fmtInTz(startUtc);

    console.log("[schedule] booked", { calendarId: CALENDAR_ID, startUtc, endUtc, attendeeEmail, meetLink });

    return NextResponse.json({ ok: true, eventId: ev?.id, htmlLink: ev?.htmlLink, meetLink, when }, { status: 200 });
  } catch (err: any) {
    const g = err?.response?.data;
    const message = g?.error?.message || g?.error_description || err?.message || "Unknown scheduling error";
    console.error("[schedule] error", message);
    return NextResponse.json({ error: message, google: g || null }, { status: 500 });
  }
}
