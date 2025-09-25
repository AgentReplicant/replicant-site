// app/api/chat/route.ts
import { NextResponse } from "next/server";
import { brainProcess } from "../../../lib/brain";
import type { BrainCtx } from "../../../lib/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const ctx: BrainCtx = {
      channel: "web",
      tzLabel: process.env.BOOKING_TZ || "America/New_York",
      sessionId: body.sessionId || undefined,
      page: body?.filters?.page ?? 0,
      date: body?.filters?.date ?? null,
      lead: {
        email: body?.email,
        phone: body?.phone,
        name: body?.name,
      },
    };

    const input = body?.pickSlot
      ? { pickSlot: body.pickSlot }
      : { message: String(body?.message || "") };

    const result = await brainProcess(input, ctx);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("[chat] error", e?.message || e);
    return NextResponse.json(
      { type: "error", text: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
