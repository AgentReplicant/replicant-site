// app/api/slots/route.ts
import { NextResponse } from "next/server";
import { google, calendar_v3 } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ---------- ENV ---------- */
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";
const SA_JSON = process.env.GOOGLE_SA_JSON || "";
const SA_IMPERSONATE = process.env.GOOGLE_SA_IMPERSONATE || "";

/** Booking rules via env (same shape you already used) */
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

function requireEnv(name: string, val?: string) {
  if (!val) throw new Error(`Missing required env: ${name}`);
}

/** -------- Time helpers (TZ-safe) -------- */

/** Offset minutes for a given Date instant in a given IANA time zone. */
function offsetMinutesAt(date: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "UTC";
  // Examples: "GMT-4", "UTC-05:00"
  const m = tzName.match(/([+-]\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return 0;
  const sign = m[1].startsWith("-") ? -1 : 1;
  const h = Math.abs(parseInt(m[1], 10));
  const mm = m[2] ? parseInt(m[2], 10) : 0;
  return sign * (h * 60 + mm);
}

/** Convert a TZ wall-clock time → RFC3339 UTC (with Z) */
function tzWallToUtcISO(y: number, m: number, d: number, hh: number, mm: number, tz: string): string {
  // Start with the "same numbers" in UTC, then subtract the tz offset at that instant.
  const asIfUtc = Date.UTC(y, m - 1, d, hh, mm);
  const guess = new Date(asIfUtc);
  const offMin = offsetMinutesAt(guess, tz);
  const utcMillis = asIfUtc - offMin * 60_000;
  return new Date(utcMillis).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function weekdayInTz(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" })
    .format(d)
    .toLowerCase()
    .slice(0, 3) as (typeof DOW)[number]; // "mon"..."sun"
}

function ymdInTz(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, dd] = fmt.format(d).split("-");
  return { y: Number(y), m: Number(m), d: Number(dd) };
}

function labelInTz(y: number, m: number, d: number, hh: number, mm: number, tz: string) {
  // Human label: "Fri, Sep 12, 5:00 PM"
  const isoZ = tzWallToUtcISO(y, m, d, hh, mm, tz);
  return new Date(isoZ).toLocaleString("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** ---------- Google client (SA + impersonation) ---------- */
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

  // Pass the GoogleAuth instance (typing-safe)
  return google.calendar({ version: "v3", auth }) as calendar_v3.Calendar;
}

/** ---------- Route ---------- */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const days = Math.max(1, Math.min(14, Number(url.searchParams.get("days") || 7)));
    const limit = Math.max(1, Math.min(30, Number(url.searchParams.get("limit") || 8)));
    const hideBusy = url.searchParams.get("hideBusy") === "1"; // optional

    // Rules
    let rules: Rules = { slotMinutes: 30, stacking: true };
    try {
      rules = { ...rules, ...(JSON.parse(process.env.BOOKING_RULES_JSON || "{}") as Rules) };
    } catch {}

    const cal = await getCalendar();

    const out: { start: string; end: string; label: string; busy?: boolean }[] = [];
    const now = new Date();

    for (let i = 0; i < days && out.length < limit; i++) {
      const dayDate = new Date(now.getTime() + i * 86400000);
      const dow = weekdayInTz(dayDate, BOOKING_TZ);
      const windows = (rules as any)[dow] as [string, string][] | undefined;
      if (!windows || windows.length === 0) continue;

      // Day Y-M-D in TZ
      const { y, m, d } = ymdInTz(dayDate, BOOKING_TZ);

      // Query busy blocks once for the whole day window
      // (min start to max end of configured windows)
      let minStart = 24 * 60, maxEnd = 0;
      for (const [s, e] of windows) {
        const [sh, sm] = s.split(":").map(Number);
        const [eh, em] = e.split(":").map(Number);
        minStart = Math.min(minStart, sh * 60 + sm);
        maxEnd = Math.max(maxEnd, eh * 60 + em);
      }
      const dayStartIsoZ = tzWallToUtcISO(y, m, d, Math.floor(minStart / 60), minStart % 60, BOOKING_TZ);
      const dayEndIsoZ = tzWallToUtcISO(y, m, d, Math.floor((maxEnd - 1) / 60), (maxEnd - 1) % 60, BOOKING_TZ);

      let busy: { start: number; end: number }[] = [];
      try {
        const fb = await cal.freebusy.query({
          requestBody: {
            timeMin: dayStartIsoZ,
            timeMax: dayEndIsoZ,
            timeZone: "UTC",
            items: [{ id: CALENDAR_ID }],
          },
        });
        const calBusy = (fb.data.calendars as any)?.[CALENDAR_ID]?.busy ?? [];
        busy = calBusy.map((b: { start?: string; end?: string }) => ({
          start: b.start ? Date.parse(b.start) : 0,
          end: b.end ? Date.parse(b.end) : 0,
        }));
      } catch (e) {
        // If the read scope isn’t granted yet, quietly fall back to "unknown busy"
        busy = [];
      }

      const step = Math.max(5, Math.min(240, rules.slotMinutes ?? 30));
      const nowInTzMs = Date.parse(
        tzWallToUtcISO(...Object.values(ymdInTz(now, BOOKING_TZ)) as [number, number, number], now.getUTCHours(), now.getUTCMinutes(), BOOKING_TZ)
      );

      for (const [startHHMM, endHHMM] of windows) {
        const [sh, sm] = startHHMM.split(":").map(Number);
        const [eh, em] = endHHMM.split(":").map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;

        for (let mins = startMins; mins + step <= endMins; mins += step) {
          const hh = Math.floor(mins / 60);
          const mm = mins % 60;

          const startIsoZ = tzWallToUtcISO(y, m, d, hh, mm, BOOKING_TZ);
          const endIsoZ = tzWallToUtcISO(y, m, d, Math.floor((mins + step) / 60), (mins + step) % 60, BOOKING_TZ);

          // don't offer past times (in TZ)
          if (Date.parse(startIsoZ) <= nowInTzMs) continue;

          const isBusy = busy.some((b) => Math.max(Date.parse(startIsoZ), b.start) < Math.min(Date.parse(endIsoZ), b.end));

          // naive strings for UI (unchanged shape + busy flag)
          const hhStr = String(hh).padStart(2, "0");
          const mmStr = String(mm).padStart(2, "0");
          const endTotal = mins + step;
          const ehhStr = String(Math.floor(endTotal / 60)).padStart(2, "0");
          const emmStr = String(endTotal % 60).padStart(2, "0");

          out.push({
            start: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${hhStr}:${mmStr}:00`,
            end: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${ehhStr}:${emmStr}:00`,
            label: labelInTz(y, m, d, hh, mm, BOOKING_TZ),
            busy: isBusy,
          });

          if (out.length >= limit) break;
        }
        if (out.length >= limit) break;
      }
    }

    // optionally hide busy, else return with busy flags so UI can grey them out
    const slots = (hideBusy ? out.filter((s) => !s.busy) : out).slice(0, limit);
    return NextResponse.json({ ok: true, slots });
  } catch (err: any) {
    const msg = err?.message || "Failed to compute slots";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
