import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;
  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events');
  const state = 'replicant_oauth_' + Math.random().toString(36).slice(2);

  // access_type=offline + prompt=consent ensures a refresh_token the first time
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${scope}` +
    `&access_type=offline` +
    `&include_granted_scopes=true` +
    `&prompt=consent` +
    `&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(authUrl);
}
