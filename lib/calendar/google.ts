// lib/calendar/google.ts
//
// Shared Google Calendar adapter for Replicant.
// Owns: auth, slot lookup, free/busy, lead-time guard, event creation.
// Does NOT own: SendGrid confirmation (stays in /api/schedule for now).
//
// Server-only — never import from client components.

import "server-only";
import { google, calendar_v3 } from "googleapis";
import type { Slot, DateFilter } from "@/lib/shared/types";

// ---------- Config ----------

const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "";
const SA_JSON = process.env.GOOGLE_SA_JSON || "";

const LEAD_MIN_DEFAULT = 60;
const _rawLead =
  process.env.SLOTS_LEAD_MINUTES ??
  process.env.BOOKING_LEAD_MINUTES ??
  `${LEAD_MIN_DEFAULT}`;
const _parsedLead = parseInt(_rawLead, 10);
const LEAD_MINUTES =
  Number.isFinite(_parsedLead) && _parsedLead >= 0 && _parsedLead <= 1440
    ? _parsedLead
    : LEAD_MIN_DEFAULT;

type Rules = {
  mon?: [string, string][];
  tue?: [string, string][];
  wed?: [string, string][];
  thu?: [string, string][];
  fri?: [string, string][];
  sat?: [string, string][];
  sun?: [string, string][];
  slotMinutes?: number;
  stacking?: boolean;
};

function readRules(): Rules {
  let base: Rules = { slotMinutes: 30, stacking: true };
  try {
    base = {
      ...base,
      ...(JSON.parse(process.env.BOOKING_RULES_JSON || "{}") as Rules),
    };
  } catch {}
  return base;
}

function requireConfig() {
  if (!SA_JSON || !CALENDAR_ID) {
    throw new Error(
      "Calendar not configured. Missing GOOGLE_SA_JSON or GOOGLE_CALENDAR_ID."
    );
  }
}

// ---------- Public error types ----------

export type BookingErrorCode =
  | "LEAD_WINDOW"
  | "SLOT_TAKEN"
  | "BAD_REQUEST"
  | "CONFIG"
  | "INTERNAL";

export class CalendarError extends Error {
  code: BookingErrorCode;
  constructor(code: BookingErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "CalendarError";
  }
}

// ---------- Auth ----------

let _calendarSingleton: calendar_v3.Calendar | null = null;

function getCalendar(): calendar_v3.Calendar {
  if (_calendarSingleton) return _calendarSingleton;
  requireConfig();
  const credentials = JSON.parse(SA_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
  });
  _calendarSingleton = google.calendar({ version: "v3", auth }) as calendar_v3.Calendar;
  return _calendarSingleton;
}

// ---------- Date/timezone helpers ----------

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function tzOffsetString(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  tz: string
) {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  }).formatToParts(guess);
  const tzn = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+00";
  const m1 = tzn.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);
  const sign = m1?.[1]?.startsWith("-") ? "-" : "+";
  const hhOff = Math.abs(parseInt(m1?.[1] || "0", 10));
  const mmOff = parseInt(m1?.[2] || "0", 10);
  return `${sign}${pad2(hhOff)}:${pad2(mmOff)}`;
}

function wallToUtcZ(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  tz: string
) {
  const off = tzOffsetString(y, m, d, hh, mm, tz);
  const isoLocalWithOffset = `${y}-${pad2(m)}-${pad2(d)}T${pad2(hh)}:${pad2(mm)}:00${off}`;
  return new Date(isoLocalWithOffset).toISOString();
}

function dayUtcWindowZ(y: number, m: number, d: number, tz: string) {
  const startZ = wallToUtcZ(y, m, d, 0, 0, tz);
  const endZ = wallToUtcZ(y, m, d, 23, 59, tz);
  return { startZ, endZ };
}

function fmtLabel(d: Date, tz: string) {
  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  return `${datePart} at ${timePart} ET`;
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

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

export function isIsoUtcZ(v?: string): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v);
}

// ---------- Slot lookup ----------

export async function getAvailableSlots(args: {
  date?: DateFilter;
  days?: number;
  limit?: number;
  page?: number;
}): Promise<Slot[]> {
  requireConfig();
  const tz = BOOKING_TZ;
  const date = args.date ?? null;
  const limit = Math.max(1, Math.min(30, args.limit ?? 8));
  const days = Math.max(1, Math.min(14, args.days ?? (date ? 1 : 7)));
  let page = args.page ?? 0;
  if (!Number.isFinite(page) || page < 0) page = 0;

  const rules = readRules();
  const step = rules.slotMinutes ?? 30;
  const calendar = getCalendar();
  const leadCutoffMs = Date.now() + LEAD_MINUTES * 60_000;

  let cursor = date
    ? new Date(Date.UTC(date.y, date.m - 1, date.d, 12, 0, 0))
    : new Date();

  const enabled: Slot[] = [];
  const targetEnabled = (page + 1) * limit;

  for (let dayIdx = 0; dayIdx < days && enabled.length < targetEnabled; dayIdx++) {
    const wallParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(cursor)
      .reduce<Record<string, string>>((acc, p) => ((acc[p.type] = p.value), acc), {});

    const year = Number(wallParts.year);
    const month = Number(wallParts.month);
    const day = Number(wallParts.day);

    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
    })
      .format(cursor)
      .toLowerCase()
      .slice(0, 3) as "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

    const windows = (rules as any)[weekday] as [string, string][] | undefined;
    if (!windows || windows.length === 0) {
      cursor = new Date(cursor.getTime() + 86_400_000);
      continue;
    }

    const { startZ: dayStartZ, endZ: dayEndZ } = dayUtcWindowZ(year, month, day, tz);
    const fb = await calendar.freebusy.query({
      requestBody: {
        timeMin: dayStartZ,
        timeMax: dayEndZ,
        timeZone: tz,
        items: [{ id: CALENDAR_ID }],
      },
    });

    const busy = fb.data.calendars?.[CALENDAR_ID]?.busy || [];
    const busyRanges: Array<[number, number]> = busy.map((b: any) => [
      new Date(b.start).getTime(),
      new Date(b.end).getTime(),
    ]);

    for (const [startHHMM, endHHMM] of windows) {
      const [sh, sm] = startHHMM.split(":").map(Number);
      const [eh, em] = endHHMM.split(":").map(Number);
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;

      for (let mins = startMins; mins + step <= endMins; mins += step) {
        const hh = Math.floor(mins / 60);
        const mm = mins % 60;

        const slotStartZ = wallToUtcZ(year, month, day, hh, mm, tz);
        const slotEndZ = wallToUtcZ(
          year,
          month,
          day,
          Math.floor((mins + step) / 60),
          (mins + step) % 60,
          tz
        );

        const startMs = new Date(slotStartZ).getTime();
        const endMs = new Date(slotEndZ).getTime();

        const blockedByLead = startMs < leadCutoffMs;
        const blockedByBusy = busyRanges.some(([b0, b1]) =>
          overlaps(startMs, endMs, b0, b1)
        );

        if (!blockedByLead && !blockedByBusy) {
          enabled.push({
            start: slotStartZ,
            end: slotEndZ,
            label: fmtLabel(new Date(slotStartZ), tz),
            disabled: false,
          });
          if (enabled.length >= targetEnabled) break;
        }
      }
      if (enabled.length >= targetEnabled) break;
    }

    cursor = new Date(cursor.getTime() + 86_400_000);
  }

  const offset = page * limit;
  return enabled.slice(offset, offset + limit);
}

// ---------- Booking ----------

async function isFree(startUtc: string, endUtc: string): Promise<boolean> {
  const calendar = getCalendar();
  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: startUtc,
      timeMax: endUtc,
      timeZone: "UTC",
      items: [{ id: CALENDAR_ID }],
    },
  });
  const cal = (data.calendars as any)?.[CALENDAR_ID];
  const busy = cal?.busy ?? [];
  return !busy || busy.length === 0;
}

export type BookPhoneCallArgs = {
  start: string;
  end: string;
  email: string;
  phone: string;
  name?: string;
  notes?: string;
};

export type BookPhoneCallResult = {
  ok: true;
  eventId: string;
  htmlLink?: string;
  when: string;
  start: string;
  end: string;
  phone: string;
};

export async function bookPhoneCall(args: BookPhoneCallArgs): Promise<BookPhoneCallResult> {
  requireConfig();

  const startUtc = args.start;
  const endUtc = args.end;
  const attendeeEmail = (args.email || "").trim();
  const phone = (args.phone || "").trim();
  const name = (args.name || "").trim();
  const notes = (args.notes || "").trim();

  if (!isIsoUtcZ(startUtc) || !isIsoUtcZ(endUtc) || !attendeeEmail || !phone) {
    throw new CalendarError("BAD_REQUEST", "Required: start, end, email, and phone.");
  }

  const cutoff = Date.now() + LEAD_MINUTES * 60_000;
  if (new Date(startUtc).getTime() < cutoff) {
    throw new CalendarError(
      "LEAD_WINDOW",
      `Earliest bookable time is +${LEAD_MINUTES} minutes from now.`
    );
  }

  const free = await isFree(startUtc, endUtc);
  if (!free) {
    throw new CalendarError("SLOT_TAKEN", "That time was just taken. Please pick another.");
  }

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

  const event: calendar_v3.Schema$Event = {
    summary: "Replicant phone call",
    description: descLines.join("\n"),
    start: { dateTime: startUtc },
    end: { dateTime: endUtc },
  };

  const calendar = getCalendar();
  const { data: ev } = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: event,
  });

  if (!ev?.id) {
    throw new CalendarError("INTERNAL", "Calendar event insert returned no id.");
  }

  const when = fmtInTz(startUtc);
  console.log("[calendar] booked", {
    calendarId: CALENDAR_ID,
    startUtc,
    endUtc,
    attendeeEmail,
    phone,
    eventId: ev.id,
  });

  return {
    ok: true,
    eventId: ev.id,
    htmlLink: ev.htmlLink || undefined,
    when,
    start: startUtc,
    end: endUtc,
    phone,
  };
}