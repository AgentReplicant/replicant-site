// app/api/schedule/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { google, calendar_v3 } from "googleapis";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";
const SA_JSON = process.env.GOOGLE_SA_JSON || "";
const SA_IMPERSONATE = process.env.GOOGLE_SA_IMPERSONATE || "";
const LEAD_MINUTES = Number(process.env.SLOTS_LEAD_MINUTES || process.env.BOOKING_LEAD_MINUTES || 60);

function isIsoUtcZ(v?: string): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v);
}
function fmtInTz(isoUtcZ: string) {
  return new Date(isoUtcZ).toLocaleString("en-US", {
    timeZone: BOOKING_TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}
async function getCalendar(): Promise<calendar_v3.Calendar> {
  const credentials = JSON.parse(SA_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials, clientOptions: { subject: SA_IMPERSONATE },
    scopes: ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.readonly"],
  });
  return google.calendar({ version: "v3", auth }) as calendar_v3.Calendar;
}
async function isFree(calendar: calendar_v3.Calendar, calendarId: string, startUtc: string, endUtc: string) {
  const { data } = await calendar.freebusy.query({ requestBody: { timeMin: startUtc, timeMax: endUtc, timeZone: "UTC", items: [{ id: calendarId }] } });
  const cal = (data.calendars as any)?.[calendarId];
  const busy = cal?.busy ?? [];
  return !busy || busy.length === 0;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      start?: string; end?: string; email?: string;
      mode?: "video" | "phone"; phone?: string;
      summary?: string; description?: string;
    };
    if (!isIsoUtcZ(body.start) || !isIsoUtcZ(body.end) || !body.email) {
      return NextResponse.json({ error: "Required: start,end (ISO UTC with Z) and email" }, { status: 400 });
    }
    const startUtc = body.start!, endUtc = body.end!, attendeeEmail = body.email!;
    const mode = body.mode === "phone" ? "phone" : "video";
    const phone = (body.phone || "").trim();

    // Lead time
    const cutoff = Date.now() + LEAD_MINUTES * 60_000;
    if (new Date(startUtc).getTime() < cutoff) {
      return NextResponse.json({ error: `Earliest bookable time is +${LEAD_MINUTES} minutes from now.`, code: "LEAD_WINDOW" }, { status: 409 });
    }

    const calendar = await getCalendar();

    // availability
    const free = await isFree(calendar, CALENDAR_ID, startUtc, endUtc);
    if (!free) return NextResponse.json({ error: "That time was just taken. Please pick another.", code: "SLOT_TAKEN" }, { status: 409 });

    // Build event
    const event: calendar_v3.Schema$Event = {
      summary: body.summary || `Replicant — Intro Call${mode === "phone" ? " (Phone)" : ""}`,
      description:
        body.description ||
        (mode === "phone"
          ? `Phone call. We will call: ${phone || "(number not provided)"}.`
          : "Auto-booked from chat. Times shown/scheduled in ET."),
      start: { dateTime: startUtc },
      end: { dateTime: endUtc },
      attendees: [{ email: attendeeEmail }],
    };

    if (mode === "video") {
      event.conferenceData = {
        createRequest: { requestId: `replicant-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } },
      };
    }

    const { data: ev } = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: event,
      sendUpdates: "all",
      conferenceDataVersion: mode === "video" ? 1 : 0,
    });

    const meetLink =
      ev?.hangoutLink ||
      ev?.conferenceData?.entryPoints?.find((p) => p?.entryPointType === "video")?.uri ||
      null;

    const when = fmtInTz(startUtc);
    console.log("[schedule] booked", { mode, phone, calendarId: CALENDAR_ID, startUtc, endUtc, attendeeEmail, meetLink });

    return NextResponse.json({ ok: true, eventId: ev?.id, htmlLink: ev?.htmlLink, meetLink, when, start: startUtc, end: endUtc, mode, phone }, { status: 200 });
  } catch (err: any) {
    const g = err?.response?.data;
    const message = g?.error?.message || g?.error_description || err?.message || "Unknown scheduling error";
    console.error("[schedule] error", message);
    return NextResponse.json({ error: message, google: g || null }, { status: 500 });
  }
}
