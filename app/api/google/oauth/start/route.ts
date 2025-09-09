// app/api/google/oauth/start/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;
  // Minimal scope: read/write events
  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events');
  const state = 'replicant_oauth_' + Math.random().toString(36).slice(2);

  // Only rotate tokens when explicitly forced
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';
  const prompt = force ? '&prompt=consent' : ''; // ← key change

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${scope}` +
    `&access_type=offline` +
    `&include_granted_scopes=true` +
    prompt +
    `&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(authUrl);
}
