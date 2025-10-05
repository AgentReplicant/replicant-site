// app/api/chat/route.ts
import { NextResponse } from "next/server";
import { brainProcess } from "../../../lib/brain";
import type { BrainCtx } from "../../../lib/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    // Conversation history (for smarter pivots)
    const history: Array<{ role: "user" | "assistant"; content: string }> =
      Array.isArray(body?.history) ? body.history : [];
    const historyCount = history.length;

    // Pull most recent user/assistant turns
    let lastUser: string | undefined;
    let lastAssistant: string | undefined;
    for (let i = history.length - 1; i >= 0; i--) {
      const m = history[i];
      if (!lastAssistant && m.role === "assistant") lastAssistant = m.content;
      if (!lastUser && m.role === "user") lastUser = m.content;
      if (lastUser && lastAssistant) break;
    }

    // Core context
    const ctx: BrainCtx = {
      channel: "web",
      tzLabel: process.env.BOOKING_TZ || "America/New_York",
      sessionId: body.sessionId || undefined,
      historyCount,
      page: body?.filters?.page ?? 0,
      date: body?.filters?.date ?? null,
      lead: {
        email: body?.email,
        phone: body?.phone,
        name: body?.name,
      },
    };

    // Attach helper fields (not part of BrainCtx type)
    Object.assign(ctx as any, { lastUser, lastAssistant });

    // Input: either a structured booking pick or a user message
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
