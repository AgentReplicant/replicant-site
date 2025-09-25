// app/api/instagram/webhook/route.ts
import { NextResponse } from "next/server";
import { brainProcess } from "../../../../lib/brain";
import type { BrainCtx } from "../../../../lib/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const text = String(body?.message?.text || body?.text || "");
  const psid = String(body?.sender?.id || body?.psid || body?.from || "");

  const ctx: BrainCtx = {
    channel: "instagram",
    tzLabel: process.env.BOOKING_TZ || "America/New_York",
    sessionId: psid || undefined,
    page: 0,
    date: null,
  };

  const res = await brainProcess({ message: text }, ctx);
  return NextResponse.json({ ok: true, reply: res });
}
