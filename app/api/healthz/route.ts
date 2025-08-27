// app/api/healthz/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // You can add tiny checks here if you want (env presence, etc.)
  return NextResponse.json({ ok: true, service: 'replicant', ts: new Date().toISOString() });
}
