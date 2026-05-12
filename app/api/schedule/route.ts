// app/api/schedule/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { google, calendar_v3 } from "googleapis";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "";
const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";
const SA_JSON = process.env.GOOGLE_SA_JSON || "";
const LEAD_MINUTES = Number(process.env.SLOTS_LEAD_MINUTES || process.env.BOOKING_LEAD_MINUTES || 60);

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
  const credentials = JSON.parse(SA_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
  });
  return google.calendar({ version: "v3", auth }) as calendar_v3.Calendar;
}

async function isFree(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  startUtc: string,
  endUtc: string
) {
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

/**
 * Best-effort customer confirmation email.
 * Wrapped so SendGrid failures never fail the booking.
 */
async function sendCustomerConfirmation(args: {
  to: string;
  name?: string;
  phone: string;
  when: string;
}) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    console.warn("[schedule] SendGrid skipped: no SENDGRID_API_KEY");
    return;
  }
  try {
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || "agentreplicant@gmail.com";
    const fromName = process.env.SENDGRID_FROM_NAME || "Replicant";

    const greeting = args.name ? `Hi ${args.name},` : "Hi,";
    const text = [
      greeting,
      "",
      `Your call with Replicant is booked for ${args.when}.`,
      "",
      `We'll call you at: ${args.phone}.`,
      "",
      "If anything changes, just reply to this email and we'll sort it out.",
      "",
      "— Marlon, Replicant",
    ].join("\n");

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: args.to }] }],
        from: { email: fromEmail, name: fromName },
        subject: `Your Replicant call is booked — ${args.when}`,
        content: [{ type: "text/plain", value: text }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[schedule] SendGrid non-OK", { status: res.status, body });
    } else {
      console.log("[schedule] SendGrid sent", { to: args.to });
    }
  } catch (e: any) {
    console.warn("[schedule] SendGrid error", e?.message || e);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Config check — fail loudly, never silently fall back to "primary"
    if (!SA_JSON || !CALENDAR_ID) {
      return NextResponse.json(
        { error: "Calendar not configured. Missing GOOGLE_SA_JSON or GOOGLE_CALENDAR_ID." },
        { status: 500 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      start?: string;
      end?: string;
      email?: string;
      phone?: string;
      name?: string;
      notes?: string;
    };

    const startUtc = body.start;
    const endUtc = body.end;
    const attendeeEmail = (body.email || "").trim();
    const phone = (body.phone || "").trim();
    const name = (body.name || "").trim();
    const notes = (body.notes || "").trim();

    // Phone is required — this MVP only books phone calls.
    if (!isIsoUtcZ(startUtc) || !isIsoUtcZ(endUtc) || !attendeeEmail || !phone) {
      return NextResponse.json(
        { error: "Required: start, end, email, and phone." },
        { status: 400 }
      );
    }

    // Lead-time guard
    const cutoff = Date.now() + LEAD_MINUTES * 60_000;
    if (new Date(startUtc).getTime() < cutoff) {
      return NextResponse.json(
        {
          error: `Earliest bookable time is +${LEAD_MINUTES} minutes from now.`,
          code: "LEAD_WINDOW",
        },
        { status: 409 }
      );
    }

    const calendar = await getCalendar();

    // Availability
    const free = await isFree(calendar, CALENDAR_ID, startUtc, endUtc);
    if (!free) {
      return NextResponse.json(
        { error: "That time was just taken. Please pick another.", code: "SLOT_TAKEN" },
        { status: 409 }
      );
    }

    // Build event description from canonical fields.
    // We do NOT accept body.description — the description is always internally
    // generated so customer details are guaranteed to be in the event.
    const descLines = [
      `Customer name: ${name || "(not provided)"}`,
      `Customer email: ${attendeeEmail}`,
      `Customer phone: ${phone}`,
      `Source: Replicant chat booking`,
    ];
    if (notes) {
      descLines.push("");
      descLines.push(`Notes: ${notes}`);
    }

    // Build event — phone-only, no attendees, no Meet, no invites.
    const event: calendar_v3.Schema$Event = {
      summary: "Replicant phone call",
      description: descLines.join("\n"),
      start: { dateTime: startUtc },
      end: { dateTime: endUtc },
    };

    const { data: ev } = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: event,
    });

    const when = fmtInTz(startUtc);

    console.log("[schedule] booked", {
      calendarId: CALENDAR_ID,
      startUtc,
      endUtc,
      attendeeEmail,
      phone,
      eventId: ev?.id,
    });

    // Best-effort customer confirmation email (never blocks booking)
    await sendCustomerConfirmation({
      to: attendeeEmail,
      name,
      phone,
      when,
    });

    return NextResponse.json(
      {
        ok: true,
        eventId: ev?.id,
        htmlLink: ev?.htmlLink,
        when,
        start: startUtc,
        end: endUtc,
        phone,
      },
      { status: 200 }
    );
  } catch (err: any) {
    const g = err?.response?.data;
    const message =
      g?.error?.message || g?.error_description || err?.message || "Unknown scheduling error";
    console.error("[schedule] error", message);
    return NextResponse.json({ error: message, google: g || null }, { status: 500 });
  }
}