// app/api/instagram/webhook/route.ts
import { NextResponse } from "next/server";
import { brainProcess } from "@/lib/brain";
import type { BrainCtx } from "@/lib/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const payload = await req.json().catch(() => ({} as any));

  // Try common FB/IG webhook shapes
  const text =
    payload?.message?.text ??
    payload?.entry?.[0]?.messaging?.[0]?.message?.text ??
    payload?.entry?.[0]?.standby?.[0]?.message?.text ??
    "";

  const from =
    payload?.sender?.id ??
    payload?.entry?.[0]?.messaging?.[0]?.sender?.id ??
    "";

  const ctx: BrainCtx = {
    channel: "instagram",
    tzLabel: process.env.BOOKING_TZ || "America/New_York",
    sessionId: from || undefined,
    page: 0,
    date: null,
    lead: from
      ? { phone: undefined, email: undefined, name: undefined }
      : undefined,
  };

  const res = await brainProcess({ message: String(text || "") }, ctx);

  // FIX #5: Corrected encoding — replaced mojibake with proper Unicode characters
  const out =
    res.type === "text"
      ? res.text
      : res.type === "action"
        ? `${res.text} ${res.url ?? ""}`.trim()
        : res.type === "booked"
          ? `You're all set. Meet: ${res.meetLink ?? ""}`.trim()
          : res.type === "slots"
            ? res.text || "Here are some times (ET):"
            : "Sorry — something went wrong.";

  // Your IG relay likely needs JSON — return a simple envelope
  return NextResponse.json({ reply: out });
}