// app/api/schedule/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

/**
 * Required env:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REDIRECT_URI
 *   GOOGLE_CALENDAR_ID (or omit -> "primary")
 *   BOOKING_TZ (e.g., "America/New_York")
 *
 * Optional (preferred):
 *   GOOGLE_REFRESH_TOKEN
 *
 * Optional Airtable fallback if you store the token there:
 *   AIRTABLE_TOKEN, AIRTABLE_BASE_ID
 *   AIRTABLE_GOOGLE_TOKEN_TABLE (default "OAuth")
 *   AIRTABLE_GOOGLE_PROVIDER_FIELD (default "provider")
 *   AIRTABLE_GOOGLE_REFRESH_FIELD (default "refresh_token")
 */

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";
const DIRECT_REFRESH = process.env.GOOGLE_REFRESH_TOKEN || "";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const AIRTABLE_GOOGLE_TOKEN_TABLE =
  process.env.AIRTABLE_GOOGLE_TOKEN_TABLE || "OAuth";
const AIRTABLE_GOOGLE_PROVIDER_FIELD =
  process.env.AIRTABLE_GOOGLE_PROVIDER_FIELD || "provider";
const AIRTABLE_GOOGLE_REFRESH_FIELD =
  process.env.AIRTABLE_GOOGLE_REFRESH_FIELD || "refresh_token";

function isIsoUtcZ(s: unknown) {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)
  );
}

/** Convert an ISO (UTC, with Z) to a timezone-local RFC3339 WITHOUT offset/“Z”.
 *  Example: "2025-09-05T21:30:00.000Z" + America/New_York -> "2025-09-05T17:30:00"
 */
function toLocalDateTimeString(isoUtcZ: string, timeZone: string) {
  const d = new Date(isoUtcZ);
  // en-CA gives YYYY-MM-DD, 24h; we replace space with T
  const s = d.toLocaleString("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }); // -> "YYYY-MM-DD HH:MM:SS"
  return s.replace(" ", "T"); // RFC3339 local, no offset
}

async function getRefreshToken(): Promise<string> {
  if (DIRECT_REFRESH) return DIRECT_REFRESH;

  if (AIRTABLE_TOKEN && AIRTABLE_BASE_ID) {
    try {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
        AIRTABLE_GOOGLE_TOKEN_TABLE
      )}?filterByFormula=${encodeURIComponent(
        `{${AIRTABLE_GOOGLE_PROVIDER_FIELD}}="google"`
      )}&maxRecords=1`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
        cache: "no-store",
      });
      const j = await r.json();
      const rec = j?.records?.[0];
      const token =
        rec?.fields?.[AIRTABLE_GOOGLE_REFRESH_FIELD] ||
        rec?.fields?.refresh_token;
      if (token && typeof token === "string") return token;
    } catch {
      // fall through
    }
  }

  throw new Error(
    "Missing Google refresh token. Set GOOGLE_REFRESH_TOKEN or configure Airtable lookup."
  );
}

function oauthClient(refreshToken: string) {
  const client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      start?: string; // ISO with Z from chat
      end?: string;   // ISO with Z from chat
      email?: string;
      summary?: string;
      description?: string;
    };

    if (!isIsoUtcZ(body.start) || !isIsoUtcZ(body.end)) {
      return NextResponse.json(
        { error: "Invalid start/end (must be ISO UTC with Z, e.g. 2025-09-05T21:30:00.000Z)" },
        { status: 400 }
      );
    }

    // Convert to timezone-local wall time (no Z) when we also send timeZone.
    const startLocal = toLocalDateTimeString(body.start!, BOOKING_TZ);
    const endLocal   = toLocalDateTimeString(body.end!, BOOKING_TZ);

    const refreshToken = await getRefreshToken();
    const auth = oauthClient(refreshToken);
    const calendar = google.calendar({ version: "v3", auth });

    const event = {
      summary: body.summary || "Replicant — Intro Call",
      description:
        body.description ||
        "Auto-booked from website chat. Times shown and scheduled in Eastern Time.",
      start: { dateTime: startLocal, timeZone: BOOKING_TZ },
      end:   { dateTime: endLocal,   timeZone: BOOKING_TZ },
      attendees: body.email ? [{ email: body.email }] : [],
      conferenceData: {
        createRequest: {
          requestId: `replicant-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    } as const;

    const res = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: event,
      sendUpdates: "all",
      conferenceDataVersion: 1,
    });

    const ev = res.data;
    const meetLink =
      ev?.hangoutLink ||
      ev?.conferenceData?.entryPoints?.find(
        (p: any) => p?.entryPointType === "video"
      )?.uri ||
      null;

    return NextResponse.json(
      { ok: true, eventId: ev?.id, htmlLink: ev?.htmlLink, meetLink },
      { status: 200 }
    );
  } catch (err: any) {
    const g = err?.response?.data;
    const message =
      g?.error?.message ||
      g?.error_description ||
      err?.message ||
      "Unknown scheduling error";
    return NextResponse.json(
      { error: message, google: g || null },
      { status: 500 }
    );
  }
}
