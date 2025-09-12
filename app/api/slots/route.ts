// app/api/slots/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Rules = {
  mon?: [string, string][];
  tue?: [string, string][];
  wed?: [string, string][];
  thu?: [string, string][];
  fri?: [string, string][];
  sat?: [string, string][];
  sun?: [string, string][];
  slotMinutes?: number;   // default 30
  stacking?: boolean;     // unused here but preserved
};

type SlotOut = { start: string; end: string; label: string; busy?: boolean };

const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/* ------------------------------ ENV --------------------------------- */

const TZ = process.env.BOOKING_TZ || "America/New_York";
const CAL_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const LEAD_MIN = Math.max(0, Number(process.env.BOOKING_LEAD_MIN ?? 60)); // minutes

// Service Account auth (read-only for availability)
function getCalendarClient() {
  const raw = process.env.GOOGLE_SA_JSON;
  const subject = process.env.GOOGLE_SA_IMPERSONATE;
  if (!raw || !subject) {
    throw new Error("Service Account env missing: GOOGLE_SA_JSON or GOOGLE_SA_IMPERSONATE");
  }
  const creds = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: [
      "https://www.googleapis.com/auth/calendar.readonly", // list/freeBusy
    ],
    clientOptions: { subject },
  });
  return google.calendar({ version: "v3", auth });
}

/* --------------------------- TZ helpers ------------------------------ */

/** offset (minutes) of `timeZone` at the given instant */
function tzOffsetMinutes(at: Date, timeZone: string): number {
  const fmt = (tz: string) => new Date(at.toLocaleString("en-US", { timeZone: tz }));
  // difference between the same instant formatted into the two zones
  return (fmt(timeZone).getTime() - fmt("UTC").getTime()) / 60000;
}

/** Convert a local wall-clock (y,m,d,h,mm) in `timeZone` to UTC ISO (with Z). */
function localToUtcIso(
  y: number,
  m: number, // 1-12
  d: number,
  h: number,
  mm: number,
  timeZone: string
): string {
  // Start with a UTC date that has the same wall clock components.
  const pretendUtc = new Date(Date.UTC(y, m - 1, d, h, mm, 0));
  const offMin = tzOffsetMinutes(pretendUtc, timeZone);
  const utcMs = pretendUtc.getTime() - offMin * 60000;
  return new Date(utcMs).toISOString();
}

/** Make a YYYY-MM-DD string in TZ from a Date (UTC instant). */
function ymdInTz(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, day] = fmt.format(d).split("-");
  return { y, m, d: day };
}

/** Weekday ("mon"..."sun") in TZ from a Date (UTC instant). */
function weekdayInTz(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" })
    .format(d)
    .toLowerCase()
    .slice(0, 3) as (typeof DOW)[number];
}

/* --------------------------- Busy logic ------------------------------ */

type BusyBlock = { startUtc: string; endUtc: string };

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

async function getBusyBlocksForDay(calendar: ReturnType<typeof getCalendarClient>, day: Date): Promise<BusyBlock[]> {
  // day is an instant. Build local YYYY-MM-DD for TZ, then get UTC window [00:00..24:00) in TZ
  const { y, m, d } = ymdInTz(day, TZ);
  const yN = Number(y), mN = Number(m), dN = Number(d);

  const timeMin = localToUtcIso(yN, mN, dN, 0, 0, TZ);
  // end: next day 00:00
  const nextDay = new Date(Date.parse(timeMin) + 24 * 60 * 60 * 1000);
  const timeMax = nextDay.toISOString();

  const res = await calendar.events.list({
    calendarId: CAL_ID,
    singleEvents: true,
    orderBy: "startTime",
    timeMin,
    timeMax,
    showDeleted: false,
  });

  const items = res.data.items || [];
  const blocks: BusyBlock[] = [];
  for (const ev of items) {
    const s = ev.start?.dateTime || ev.start?.date; // date = all-day (treat as busy)
    const e = ev.end?.dateTime || ev.end?.date;
    if (!s || !e) continue;
    // Convert to ISO strings (Calendar returns RFC3339 already)
    const startUtc = new Date(s).toISOString();
    const endUtc = new Date(e).toISOString();
    blocks.push({ startUtc, endUtc });
  }
  return blocks;
}

/* --------------------------- Handler --------------------------------- */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const days = Math.max(1, Math.min(14, Number(url.searchParams.get("days") || 7)));
    const limit = Math.max(1, Math.min(30, Number(url.searchParams.get("limit") || 8)));

    // (optional) start from explicit y/m/d if provided
    const y = Number(url.searchParams.get("y") || NaN);
    const m = Number(url.searchParams.get("m") || NaN);
    const d = Number(url.searchParams.get("d") || NaN);
    let startAnchor = new Date(); // now (UTC instant)
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
      // interpret as local midnight in TZ, then convert to actual UTC instant
      const iso = localToUtcIso(y, m, d, 0, 0, TZ);
      startAnchor = new Date(iso);
    }

    // load rules
    let rules: Rules = { slotMinutes: 30, stacking: true };
    try {
      rules = { ...rules, ...(JSON.parse(process.env.BOOKING_RULES_JSON || "{}") as Rules) };
    } catch {}

    const step = rules.slotMinutes ?? 30;

    // Pre-calc lead-time threshold
    const nowMs = Date.now();
    const leadCutoffMs = nowMs + LEAD_MIN * 60000;

    const out: SlotOut[] = [];
    const calendar = getCalendarClient();

    // Iterate days until we fill up to `limit` slots (we still include busy slots, but mark them)
    for (let i = 0; i < days && out.length < limit; i++) {
      const dayInstant = new Date(startAnchor.getTime() + i * 86400000); // add i days (UTC instant)
      const dow = weekdayInTz(dayInstant, TZ);
      const windows = (rules as any)[dow] as [string, string][] | undefined;
      if (!windows || windows.length === 0) continue;

      // Fetch busy blocks for the day once
      const busyBlocks = await getBusyBlocksForDay(calendar, dayInstant);
      const busyRanges = busyBlocks.map((b) => [Date.parse(b.startUtc), Date.parse(b.endUtc)] as const);

      const { y: yStr, m: mStr, d: dStr } = ymdInTz(dayInstant, TZ);
      const yN = Number(yStr), mN = Number(mStr), dN = Number(dStr);

      for (const [startHHMM, endHHMM] of windows) {
        const [sh, sm] = startHHMM.split(":").map(Number);
        const [eh, em] = endHHMM.split(":").map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;

        for (let mins = startMins; mins + step <= endMins; mins += step) {
          const hh = Math.floor(mins / 60);
          const mm = mins % 60;

          // naive strings (legacy shape the chat expects)
          const hhStr = String(hh).padStart(2, "0");
          const mmStr = String(mm).padStart(2, "0");
          const endMinutes = mins + step;
          const ehhStr = String(Math.floor(endMinutes / 60)).padStart(2, "0");
          const emmStr = String(endMinutes % 60).padStart(2, "0");

          const startLocal = `${yStr}-${mStr}-${dStr}T${hhStr}:${mmStr}:00`;
          const endLocal = `${yStr}-${mStr}-${dStr}T${ehhStr}:${emmStr}:00`;

          // compute UTC instants to check against busy + lead time
          const startUtcIso = localToUtcIso(yN, mN, dN, hh, mm, TZ);
          const endUtcIso = localToUtcIso(yN, mN, dN, Math.floor(endMinutes / 60), endMinutes % 60, TZ);
          const startMs = Date.parse(startUtcIso);
          const endMs = Date.parse(endUtcIso);

          // label (correct in TZ)
          const label = new Intl.DateTimeFormat("en-US", {
            timeZone: TZ,
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(startUtcIso)).replace(",", "");

          // busy if within lead-time or overlaps an event
          const leadBlocked = startMs < leadCutoffMs;
          const eventBlocked = busyRanges.some(([bS, bE]) => overlaps(startMs, endMs, bS, bE));
          const busy = leadBlocked || eventBlocked;

          out.push({ start: startLocal, end: endLocal, label, ...(busy ? { busy: true } : {}) });

          if (out.length >= limit) break;
        }
        if (out.length >= limit) break;
      }
    }

    return NextResponse.json({ ok: true, slots: out.slice(0, limit) });
  } catch (err: any) {
    const msg = err?.message || "slots error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
