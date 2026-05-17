// app/api/chat/route.ts
import { NextResponse } from "next/server";
import { brainProcess } from "@/lib/brain";
import type { BrainCtx } from "@/lib/brain/types";
import type {
  PickSlotPayload,
  QualificationState,
  LeadProfile,
} from "@/lib/shared/types";
import { findLeadByEmailOrPhone, toLeadProfile } from "@/lib/airtable/leads";

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

    // Phase 6: returning-user lookup. Fetch whenever contact exists — leadProfile
    // is used for BOTH welcome-back (gated by memoryAcknowledged) AND qualification
    // seeding (needed every turn so Riley keeps skipping already-known fields).
    // Gating by memoryAcknowledged would starve the brain of profile context after
    // the first greeting. Failures are silent.
    let leadProfile: LeadProfile | undefined;
    const hasContact = !!(body?.email || body?.phone);
    const memoryAcknowledged = !!body?.memoryAcknowledged;
    if (hasContact) {
      try {
        const record = await findLeadByEmailOrPhone({
          email: body?.email,
          phone: body?.phone,
        });
        if (record) leadProfile = toLeadProfile(record);
      } catch {
        // Silent fail — no memory context this turn
      }
    }

    // Core context
    const ctx: BrainCtx = {
      channel: "web",
      tzLabel: process.env.BOOKING_TZ || "America/New_York",
      sessionId: body.sessionId || undefined,
      historyCount,
      page: body?.filters?.page ?? 0,
      date: body?.filters?.date ?? null,
      // FIX #1: Read lead fields that ChatWidget now sends
      lead: {
        email: body?.email,
        phone: body?.phone,
        name: body?.name,
      },
      // FIX #7: Assign directly instead of Object.assign hack — BrainCtx already supports these
      lastUser,
      lastAssistant,
      // Phase 3B: qualification state from widget (or undefined for fresh chats)
      qualification: body?.qualification as QualificationState | undefined,
      // Phase 6: returning-user memory
      leadProfile,
      memoryAcknowledged,
    };

    // Input: either a structured booking pick or a user message
    const pick = body?.pickSlot as PickSlotPayload | undefined;
    const input = pick
      ? { pickSlot: pick }
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