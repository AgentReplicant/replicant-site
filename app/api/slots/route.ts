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

function weekdayInTz(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" })
    .format(d)
    .toLowerCase()
    .slice(0, 3); // "mon"..."sun"
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.max(1, Math.min(14, Number(url.searchParams.get("days") || 7)));
  const limit = Math.max(1, Math.min(30, Number(url.searchParams.get("limit") || 8)));

  const tz = process.env.BOOKING_TZ || "America/New_York";
  let rules: Rules = { slotMinutes: 30, stacking: true };
  try {
    rules = { ...rules, ...(JSON.parse(process.env.BOOKING_RULES_JSON || "{}") as Rules) };
  } catch {}

  const out: { start: string; end: string; label: string }[] = [];
  let cursor = new Date();

  for (let i = 0; i < days && out.length < limit; i++) {
    const dayDate = new Date(cursor.getTime() + i * 86400000);
    const dow = weekdayInTz(dayDate, tz) as (typeof DOW)[number];
    const windows = (rules as any)[dow] as [string, string][] | undefined;
    if (!windows || windows.length === 0) continue;

    const { y, m, d } = ymdInTz(dayDate, tz);
    const step = rules.slotMinutes ?? 30;

    for (const [startHHMM, endHHMM] of windows) {
      // walk the window in step-min increments
      const [sh, sm] = startHHMM.split(":").map(Number);
      const [eh, em] = endHHMM.split(":").map(Number);

      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;

      for (let mins = startMins; mins + step <= endMins; mins += step) {
        const hh = String(Math.floor(mins / 60)).padStart(2, "0");
        const mm = String(mins % 60).padStart(2, "0");

        const start = `${y}-${m}-${d}T${hh}:${mm}:00`; // naive; Google uses timeZone field
        const endMinutes = mins + step;
        const ehh = String(Math.floor(endMinutes / 60)).padStart(2, "0");
        const emm = String(endMinutes % 60).padStart(2, "0");
        const end = `${y}-${m}-${d}T${ehh}:${emm}:00`;

        // human label in TZ
        const when = new Date(`${start}:00Z`); // for formatting only; not accurate TZ-wise
        const label = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        }).format(dayDate).replace(",", "") + ` ${hh}:${mm}`;

        out.push({ start, end, label });
        if (out.length >= limit) break;
      }
      if (out.length >= limit) break;
    }
  }

  return NextResponse.json({ ok: true, slots: out.slice(0, limit) });
}
