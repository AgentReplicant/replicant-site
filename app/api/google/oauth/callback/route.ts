// app/api/google/oauth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function saveRefreshTokenToAirtable(refreshToken: string) {
  const base = process.env.AIRTABLE_BASE_ID!;
  const token = process.env.AIRTABLE_TOKEN!;
  const msg = JSON.stringify({ refresh_token: refreshToken, saved_at: new Date().toISOString() });

  await fetch(`https://api.airtable.com/v0/${base}/Leads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      records: [{ fields: { Name: 'Google OAuth', Email: 'system@replicant', Message: msg, Source: 'manual' } }],
      typecast: true,
    }),
  });
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) throw new Error('Missing code');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    });
    const json = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(JSON.stringify(json));

    if (json.refresh_token) {
      await saveRefreshTokenToAirtable(json.refresh_token);
    }

    return new NextResponse(
      `<h1>Google Calendar connected ✅</h1>
       <p>You can close this tab.</p>
       <p><a href="/">Back to site</a></p>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  } catch (e: any) {
    return new NextResponse(
      `<h1>Google Calendar connect error</h1><pre>${e?.message || e}</pre>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 500 },
    );
  }
}
