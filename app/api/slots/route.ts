// app/api/slots/route.ts
import { NextResponse } from "next/server";

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
  slotMinutes?: number;
  stacking?: boolean;
};

const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/* ----------------------------- TZ helpers ----------------------------- */

function ymdInTz(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, day] = fmt.format(d).split("-");
  return { y: Number(y), m: Number(m), d: Number(day) };
}

function weekdayInTz(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" })
    .format(d)
    .toLowerCase()
    .slice(0, 3) as (typeof DOW)[number];
}

function hmInTz(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { h, m };
}

/** offset (minutes) of `tz` at the instant `utcMs` */
function tzOffsetMinutesAt(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const hh = get("hour");
  const mm = get("minute");
  const ss = get("second");
  const asUtc = Date.UTC(y, m - 1, d, hh, mm, ss);
  return (asUtc - utcMs) / 60000;
}

/** Convert a local wall time in `tz` to an ISO UTC string (…Z) */
function localTzToUtcIso(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  tz: string
): string {
  // iteration handles DST transitions
  let utc = Date.UTC(y, m - 1, d, hh, mm, 0);
  for (let i = 0; i < 3; i++) {
    const offset = tzOffsetMinutesAt(utc, tz);
    const next = Date.UTC(y, m - 1, d, hh, mm, 0) - offset * 60000;
    if (Math.abs(next - utc) < 1000) {
      utc = next;
      break;
    }
    utc = next;
  }
  return new Date(utc).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function labelFor(y: number, m: number, d: number, hh: number, mm: number, tz: string) {
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, 0);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(utcGuess));
}

/* -------------------------------- ROUTE ------------------------------- */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.max(1, Math.min(14, Number(url.searchParams.get("days") || 7)));
  const limit = Math.max(1, Math.min(30, Number(url.searchParams.get("limit") || 8)));

  const tz = process.env.BOOKING_TZ || "America/New_York";
  const leadMin = Math.max(0, Number(process.env.BOOKING_LEAD_MINUTES || 60)); // “now + lead” cutoff for today

  let rules: Rules = { slotMinutes: 30, stacking: true };
  try {
    rules = { ...rules, ...(JSON.parse(process.env.BOOKING_RULES_JSON || "{}") as Rules) };
  } catch {}

  const out: { start: string; end: string; label: string }[] = [];
  const now = new Date();

  // Today in tz + current HM in tz
  const todayYmd = ymdInTz(now, tz);
  const { h: nowH, m: nowM } = hmInTz(now, tz);
  const nowMinutesInTz = nowH * 60 + nowM;

  for (let i = 0; i < days && out.length < limit; i++) {
    const dayDate = new Date(now.getTime() + i * 86400000);
    const dow = weekdayInTz(dayDate, tz);
    const windows = (rules as any)[dow] as [string, string][] | undefined;
    if (!windows || windows.length === 0) continue;

    const { y, m, d } = ymdInTz(dayDate, tz);
    const step = rules.slotMinutes ?? 30;

    for (const [startHHMM, endHHMM] of windows) {
      const [sh, sm] = startHHMM.split(":").map(Number);
      const [eh, em] = endHHMM.split(":").map(Number);
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;

      for (let mins = startMins; mins + step <= endMins; mins += step) {
        // Filter out past times when day === today (with lead time)
        const isToday = y === todayYmd.y && m === todayYmd.m && d === todayYmd.d;
        if (isToday && mins < nowMinutesInTz + leadMin) continue;

        const hh = Math.floor(mins / 60);
        const mm = mins % 60;
        const endMinutes = mins + step;
        const ehh = Math.floor(endMinutes / 60);
        const emm = endMinutes % 60;

        // ISO UTC with Z
        const startIso = localTzToUtcIso(y, m, d, hh, mm, tz);
        const endIso = localTzToUtcIso(y, m, d, ehh, emm, tz);

        const label = labelFor(y, m, d, hh, mm, tz);

        out.push({ start: startIso, end: endIso, label });
        if (out.length >= limit) break;
      }
      if (out.length >= limit) break;
    }
  }

  return NextResponse.json({ ok: true, slots: out.slice(0, limit) });
}
