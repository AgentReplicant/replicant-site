import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AirtableRecord = { id: string; fields: Record<string, any> };

async function upsertRefreshToken(refreshToken: string) {
  const token = process.env.AIRTABLE_TOKEN!;
  const baseId = process.env.AIRTABLE_BASE_ID!;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // find "Google OAuth" row
  const search = await fetch(
    `https://api.airtable.com/v0/${baseId}/Leads?maxRecords=1&filterByFormula=${encodeURIComponent(`{Name}='Google OAuth'`)}`,
    { headers, cache: 'no-store' }
  ).then(r => r.json());

  const payload = {
    fields: {
      Name: 'Google OAuth',
      Email: 'system@replicant',
      Source: 'manual',
      Message: JSON.stringify({ refresh_token: refreshToken, saved_at: new Date().toISOString() }),
    },
  };

  if (search.records?.[0]) {
    const rec: AirtableRecord = search.records[0];
    await fetch(`https://api.airtable.com/v0/${baseId}/Leads/${rec.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
  } else {
    await fetch(`https://api.airtable.com/v0/${baseId}/Leads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ records: [{ ...payload }] }),
    });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const err = url.searchParams.get('error');

  if (err) {
    return new NextResponse(`<h1>Google OAuth Error</h1><p>${err}</p>`, {
      headers: { 'Content-Type': 'text/html' },
      status: 400,
    });
  }

  if (!code) {
    return new NextResponse('<h1>Missing code</h1>', { headers: { 'Content-Type': 'text/html' }, status: 400 });
  }

  // Exchange code -> tokens
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

  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    return new NextResponse(`<h1>Token exchange failed</h1><pre>${t}</pre>`, {
      headers: { 'Content-Type': 'text/html' },
      status: 500,
    });
  }

  const tokenJson = await tokenRes.json();
  const refresh = tokenJson.refresh_token as string | undefined;

  if (!refresh) {
    return new NextResponse(
      `<h1>Connected, but no refresh_token was returned.</h1><p>Try again with prompt=consent, and make sure you're approving for the first time.</p>`,
      { headers: { 'Content-Type': 'text/html' }, status: 200 }
    );
  }

  await upsertRefreshToken(refresh);

  return new NextResponse(
    `<h1>Google Calendar connected ✅</h1><p>You can close this tab.</p><p><a href="/">Back to site</a></p>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}
