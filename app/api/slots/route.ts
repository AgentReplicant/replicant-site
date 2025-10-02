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
  slotMinutes?: number;
  stacking?: boolean;
};

const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const SA_JSON = process.env.GOOGLE_SA_JSON || "";
const SA_SUBJECT = process.env.GOOGLE_SA_IMPERSONATE || "";

// Lead-time (mins) from env with sane fallback + bounds
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

function fmtLabel(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  })
    .format(d)
    .replace(",", "");
}
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
  const isoLocalWithOffset = `${y}-${pad2(m)}-${pad2(
    d
  )}T${pad2(hh)}:${pad2(mm)}:00${off}`;
  return new Date(isoLocalWithOffset).toISOString();
}
function dayUtcWindowZ(y: number, m: number, d: number, tz: string) {
  const startZ = wallToUtcZ(y, m, d, 0, 0, tz);
  const endZ = wallToUtcZ(y, m, d, 23, 59, tz);
  return { startZ, endZ };
}
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
function getCalendarClient() {
  if (!SA_JSON || !SA_SUBJECT)
    throw new Error(
      "Service Account not configured. Missing GOOGLE_SA_JSON or GOOGLE_SA_IMPERSONATE."
    );
  const creds = JSON.parse(SA_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    clientOptions: { subject: SA_SUBJECT },
  });
  return google.calendar({ version: "v3", auth });
}
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Enabled-first paging over slots.
 * - Honors `page` & `limit`
 * - Only returns enabled (bookable) slots; keeps shape with `disabled:false`
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tz = BOOKING_TZ;

    const y = Number(url.searchParams.get("y"));
    const m = Number(url.searchParams.get("m"));
    const d = Number(url.searchParams.get("d"));

    const days = Math.max(
      1,
      Math.min(
        14,
        Number(url.searchParams.get("days") || (y && m && d ? 1 : 7))
      )
    );

    const limit = Math.max(
      1,
      Math.min(30, Number(url.searchParams.get("limit") || 8))
    );

    let page = parseInt(url.searchParams.get("page") || "0", 10);
    if (!Number.isFinite(page) || page < 0) page = 0;

    const rules = readRules();
    const step = rules.slotMinutes ?? 30;

    const calendar = getCalendarClient();

    const leadCutoffMs = Date.now() + LEAD_MINUTES * 60_000;

    // Start cursor from provided date (local noon to avoid DST edges) or now
    let cursor =
      y && m && d
        ? new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
        : new Date();

    // Collect ENABLED slots only, then page/slice them
    const enabled: { start: string; end: string; label: string }[] = [];
    const targetEnabled = (page + 1) * limit;

    for (let dayIdx = 0; dayIdx < days && enabled.length < targetEnabled; dayIdx++) {
      // Resolve current day in requested timezone
      const wallParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(cursor)
        .reduce<Record<string, string>>(
          (acc, p) => ((acc[p.type] = p.value), acc),
          {}
        );

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

      // Free/busy for the whole day in one shot
      const { startZ: dayStartZ, endZ: dayEndZ } = dayUtcWindowZ(
        year,
        month,
        day,
        tz
      );
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
            });

            // Only collect up to the end of the requested page
            if (enabled.length >= targetEnabled) break;
          }
        }
        if (enabled.length >= targetEnabled) break;
      }

      // Advance to next calendar day
      cursor = new Date(cursor.getTime() + 86_400_000);
    }

    const offset = page * limit;
    const pageSlice = enabled.slice(offset, offset + limit);

    console.log("[slots] returned", {
      page,
      limit,
      leadMinutes: LEAD_MINUTES,
      enabledCollected: enabled.length,
      returned: pageSlice.length,
    });

    // Keep response shape consistent with existing client
    return NextResponse.json({
      ok: true,
      slots: pageSlice.map((s) => ({ ...s, disabled: false })),
    });
  } catch (err: any) {
    const msg = err?.message || "Unable to generate slots";
    console.error("[slots] error", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
