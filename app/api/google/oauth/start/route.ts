import { NextResponse } from "next/server";

export async function GET() {
  const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = process.env;

  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json({ error: "Missing GOOGLE_CLIENT_ID" }, { status: 500 });
  }

  // Where Google should send users back after consent:
  const redirect =
    GOOGLE_REDIRECT_URI ||
    "https://replicant-site.vercel.app/api/google/oauth/callback";

  const scope = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar.events",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID!,
    redirect_uri: redirect,
    response_type: "code",
    access_type: "offline",   // get refresh_token
    prompt: "consent",        // force refresh_token first time
    scope,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}

