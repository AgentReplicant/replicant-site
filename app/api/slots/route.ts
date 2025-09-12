// app/api/slots/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ----------------------------- ENV & CONSTANTS ---------------------------- */

const SA_JSON = process.env.GOOGLE_SA_JSON || "";
const SA_SUBJECT = process.env.GOOGLE_SA_IMPERSONATE || "";
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";

const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";

// Optional JSON like:
// {"mon":[["09:00","12:00"],["14:00","18:00"]],"tue":[["09:00","17:00"]], ...,
//  "slotMinutes":30,"stacking":true}
const RULES_RAW = process.env.BOOKING_RULES_JSON || "";

const DEFAULT_SLOT_MIN = 30;    // each slot 30 minutes
const LEAD_MINUTES = 60;        // must be at least 1 hour from now
const BUFFER_MINUTES = 0;       // no buffer after events

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

const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/* --------------------------------- UTILS ---------------------------------- */

function safeParseRules(raw: string): Rules {
  try {
    const j = JSON.parse(raw || "{}");
    return j ?? {};
  } catch {
    return {};
  }
}

function fmtLabel(date: Date, tz: string) {
  return date.toLocaleString("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).replace(",", "");
}

function weekdayInTz(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" })
    .format(d)
    .toLowerCase()
    .slice(0, 3) as (typeof DOW)[number];
}

/**
 * Compute the timezone offset (in minutes) for `date` in IANA `tz`.
 * Negative for zones west of UTC (e.g., -240 for EDT).
 */
function tzOffsetMinutes(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || "0");
  const utcLike = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  // difference between the "as-UTC" timestamp and the real epoch gives offset
  return (utcLike - date.getTime()) / 60000;
}

/**
 * Convert local wall-clock time (y-m-d hh:mm in tz) to a real UTC ISO string.
 */
function localToUtcISO(y: number, m: number, d: number, hh: number, mm: number, tz: string) {
  // guess this local time as if it were UTC
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  const off = tzOffsetMinutes(tz, guess);
  const utc = new Date(guess.getTime() - off * 60000);
  return utc.toISOString();
}

function ymdInTz(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const [y, m, day] = fmt.format(d).split("-");
  return { y: Number(y), m: Number(m), d: Number(day) };
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return !(aEnd <= bStart || bEnd <= aStart);
}

/* ------------------------------- GOOGLE AUTH ------------------------------ */

async function getCalendarAuth() {
  if (!SA_JSON || !SA_SUBJECT) throw new Error("GOOGLE_SA_JSON / GOOGLE_SA_IMPERSONATE missing");
  const creds = JSON.parse(SA_JSON);
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    subject: SA_SUBJECT,
  });
  await auth.authorize();
  return auth;
}

/* ---------------------------------- API ----------------------------------- */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // query params
    const days = Math.max(1, Math.min(14, Number(url.searchParams.get("days") || 7)));
    const limit = Math.max(1, Math.min(30, Number(url.searchParams.get("limit") || 8)));
    const page = Math.max(0, Number(url.searchParams.get("page") || 0));

    // optional specific day filter (from UI day picker)
    const y = Number(url.searchParams.get("y") || 0);
    const m = Number(url.searchParams.get("m") || 0);
    const d = Number(url.searchParams.get("d") || 0);
    const pinnedDay = y && m && d ? new Date(Date.UTC(y, m - 1, d, 12, 0, 0)) : null;

    // rules
    const rules = { slotMinutes: DEFAULT_SLOT_MIN, stacking: true, ...safeParseRules(RULES_RAW) } as Rules;
    const step = Math.max(5, rules.slotMinutes ?? DEFAULT_SLOT_MIN);

    // walk days and build naive candidate slots (label + UTC window)
    const candidates: { start: string; end: string; label: string }[] = [];
    const now = new Date();
    const leadCutoff = new Date(now.getTime() + LEAD_MINUTES * 60000);

    let startCursor = pinnedDay ?? now;
    // page forward by whole days
    if (page > 0) startCursor = new Date(startCursor.getTime() + page * 86400000);

    for (let i = 0; i < days && candidates.length < limit; i++) {
      const dayDate = new Date(startCursor.getTime() + i * 86400000);
      const dow = weekdayInTz(dayDate, BOOKING_TZ);
      const windows = (rules as any)[dow] as [string, string][] | undefined;
      if (!windows || windows.length === 0) continue;

      const { y: yy, m: mm, d: dd } = ymdInTz(dayDate, BOOKING_TZ);

      for (const [startHHMM, endHHMM] of windows) {
        const [sh, sm] = startHHMM.split(":").map(Number);
        const [eh, em] = endHHMM.split(":").map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;

        for (let mins = startMins; mins + step <= endMins; mins += step) {
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          const endMinutes = mins + step;
          const ehh = Math.floor(endMinutes / 60);
          const emm = endMinutes % 60;

          const startUtc = localToUtcISO(yy, mm, dd, h, m, BOOKING_TZ);
          const endUtc = localToUtcISO(yy, mm, dd, ehh, emm, BOOKING_TZ);

          // lead-time cutoff
          if (new Date(startUtc) < leadCutoff) continue;

          const label = fmtLabel(new Date(startUtc), BOOKING_TZ);
          candidates.push({ start: startUtc, end: endUtc, label });
          if (candidates.length >= limit) break;
        }
        if (candidates.length >= limit) break;
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, slots: [] });
    }

    // Determine a single min/max range for free-busy
    const rangeStart = candidates.reduce((a, c) => (c.start < a ? c.start : a), candidates[0].start);
    const rangeEnd = candidates.reduce((a, c) => (c.end > a ? c.end : a), candidates[0].end);

    // fetch busy ranges once
    const auth = await getCalendarAuth();
    const calendar = google.calendar({ version: "v3", auth });

    const fb = await calendar.freebusy.query({
      requestBody: {
        timeMin: rangeStart,
        timeMax: rangeEnd,
        items: [{ id: CALENDAR_ID }],
      },
    });

    const busyBlocks =
      (fb.data.calendars &&
        (fb.data.calendars as any)[CALENDAR_ID] &&
        (fb.data.calendars as any)[CALENDAR_ID].busy) ||
      [];

    // apply buffer (0 by default)
    const bufferedBusy = (busyBlocks as { start: string; end: string }[]).map((b) => ({
      start: new Date(new Date(b.start).getTime() - BUFFER_MINUTES * 60000).toISOString(),
      end: new Date(new Date(b.end).getTime() + BUFFER_MINUTES * 60000).toISOString(),
    }));

    // mark each candidate free/busy
    const slots = candidates.map((s) => {
      const isBusy = bufferedBusy.some((b) => overlaps(s.start, s.end, b.start, b.end));
      return { ...s, free: !isBusy };
    });

    return NextResponse.json({ ok: true, slots });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "slots error" },
      { status: 500 }
    );
  }
}
