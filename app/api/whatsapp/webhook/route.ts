// app/api/whatsapp/webhook/route.ts
import { NextResponse } from "next/server";
import { brainProcess } from "../../../../lib/brain";
import type { BrainCtx } from "../../../../lib/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const text = String(body?.message?.text || body?.text || body?.Body || "");
  const from = String(body?.from || body?.From || "");

  const ctx: BrainCtx = {
    channel: "whatsapp",
    tzLabel: process.env.BOOKING_TZ || "America/New_York",
    sessionId: from || undefined,
    page: 0,
    date: null,
    lead: from ? { phone: from } : undefined,
  };

  const res = await brainProcess({ message: text }, ctx);
  return NextResponse.json({ ok: true, reply: res });
}
