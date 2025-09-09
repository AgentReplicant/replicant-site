// app/api/google/check/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
    const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;
    const REFRESH = process.env.GOOGLE_REFRESH_TOKEN;

    if (!REFRESH) {
      return NextResponse.json({ ok: false, reason: "no_refresh_token" }, { status: 400 });
    }

    const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    auth.setCredentials({ refresh_token: REFRESH });

    const cal = google.calendar({ version: "v3", auth });
    // Use events.list so the current scope (calendar.events) is sufficient
    await cal.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
      maxResults: 1,
      singleEvents: true,
      orderBy: "startTime",
      timeMin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const g = e?.response?.data;
    return NextResponse.json({ ok: false, error: msg, google: g ?? null }, { status: 500 });
  }
}
