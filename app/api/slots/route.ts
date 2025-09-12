// app/api/slots/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";

/**
 * Runtime flags
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Types
 */
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

/**
 * Env
 */
const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const SA_JSON = process.env.GOOGLE_SA_JSON || "";
const SA_SUBJECT = process.env.GOOGLE_SA_IMPERSONATE || "";

/**
 * Helpers
 */
const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function fmtLabel(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(d).replace(",", "");
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Get a "+/-HH:MM" offset string for a given wall clock in a TZ.
 * We use timeZoneName: 'shortOffset' (Node 18+/Vercel supported) to read "GMT-4" etc.
 */
function tzOffsetString(y: number, m: number, d: number, hh: number, mm: number, tz: string) {
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
  // tzn like "GMT-4" or "GMT-05:00"
  const m1 = tzn.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);
  const sign = m1?.[1]?.startsWith("-") ? "-" : "+";
  const hhOff = Math.abs(parseInt(m1?.[1] || "0", 10));
  const mmOff = parseInt(m1?.[2] || "0", 10);
  return `${sign}${pad2(hhOff)}:${pad2(mmOff)}`;
}

/**
 * Convert a wall-clock time in a TZ to an RFC3339 UTC Z string.
 */
function wallToUtcZ(y: number, m: number, d: number, hh: number, mm: number, tz: string) {
  const off = tzOffsetString(y, m, d, hh, mm, tz); // e.g. -04:00
  const isoLocalWithOffset = `${y}-${pad2(m)}-${pad2(d)}T${pad2(hh)}:${pad2(mm)}:00${off}`;
  return new Date(isoLocalWithOffset).toISOString(); // -> UTC "Z"
}

/**
 * Build the day window [00:00, 23:59:59] in UTC Z for a given date in TZ.
 */
function dayUtcWindowZ(y: number, m: number, d: number, tz: string) {
  const startZ = wallToUtcZ(y, m, d, 0, 0, tz);
  // 23:59 (we don't need seconds precision for freeBusy overlap)
  const endZ = wallToUtcZ(y, m, d, 23, 59, tz);
  return { startZ, endZ };
}

/**
 * Read booking rules from env. Fallbacks keep the old behavior.
 */
function readRules(): Rules {
  let base: Rules = { slotMinutes: 30, stacking: true };
  try {
    base = { ...base, ...(JSON.parse(process.env.BOOKING_RULES_JSON || "{}") as Rules) };
  } catch {}
  return base;
}

/**
 * Auth for Google Calendar (Service Account + impersonation)
 */
function getCalendarClient() {
  if (!SA_JSON || !SA_SUBJECT) {
    throw new Error("Service Account not configured. Missing GOOGLE_SA_JSON or GOOGLE_SA_IMPERSONATE.");
  }
  const creds = JSON.parse(SA_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    clientOptions: { subject: SA_SUBJECT },
  });
  return google.calendar({ version: "v3", auth });
}

/**
 * Overlap test
 */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Route
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tz = BOOKING_TZ;

    // Optional explicit day; otherwise we walk forward day-by-day
    const y = Number(url.searchParams.get("y"));
    const m = Number(url.searchParams.get("m"));
    const d = Number(url.searchParams.get("d"));

    const days = Math.max(1, Math.min(14, Number(url.searchParams.get("days") || (y && m && d ? 1 : 7))));
    const limit = Math.max(1, Math.min(30, Number(url.searchParams.get("limit") || 8)));

    const rules = readRules();
    const step = rules.slotMinutes ?? 30;

    const calendar = getCalendarClient();

    const out: { start: string; end: string; label: string; disabled?: boolean }[] = [];

    // Lead-time window (we decided on at least 60 minutes)
    const LEAD_MINUTES = 60;
    const leadCutoffMs = Date.now() + LEAD_MINUTES * 60_000;

    // Cursor day
    let cursor = y && m && d ? new Date(Date.UTC(y, m - 1, d, 12, 0, 0)) : new Date();

    for (let dayIdx = 0; dayIdx < days && out.length < limit; dayIdx++) {
      // Determine this day in TZ
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

      // Which windows apply for this day-of-week?
      const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "short",
      })
        .format(cursor)
        .toLowerCase()
        .slice(0, 3) as (typeof DOW)[number];

      const windows = (rules as any)[weekday] as [string, string][] | undefined;
      if (!windows || windows.length === 0) {
        // advance a day
        cursor = new Date(cursor.getTime() + 86400000);
        continue;
      }

      // Fetch busy blocks once per day
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
      const busyRanges: Array<[number, number]> = busy.map((b) => [
        new Date(b.start as string).getTime(),
        new Date(b.end as string).getTime(),
      ]);

      // Walk each window in step-min increments
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

          // Disabled if inside lead window OR overlaps any busy block
          const blockedByLead = startMs < leadCutoffMs;
          const blockedByBusy = busyRanges.some(([b0, b1]) => overlaps(startMs, endMs, b0, b1));

          const label = fmtLabel(new Date(slotStartZ), tz);

          out.push({
            start: slotStartZ,
            end: slotEndZ,
            label,
            disabled: blockedByLead || blockedByBusy,
          });

          if (out.length >= limit) break;
        }
        if (out.length >= limit) break;
      }

      // Advance one day
      cursor = new Date(cursor.getTime() + 86400000);
    }

    return NextResponse.json({ ok: true, slots: out.slice(0, limit) });
  } catch (err: any) {
    const msg = err?.message || "Unable to generate slots";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
