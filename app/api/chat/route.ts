// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HistMsg = { role: "user" | "assistant"; content: string };
type Slot = { start: string; end: string; label: string; disabled?: boolean };

function stripeLink() {
  return process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || process.env.STRIPE_PAYMENT_LINK || "";
}

function pickFirstEnabled(slots: Slot[], n = 3) {
  return slots.filter(s => !s.disabled).slice(0, n);
}

function txt(s: string) {
  return NextResponse.json({ type: "text", text: s });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const history: HistMsg[] = Array.isArray(body?.history) ? body.history : [];
  const message = (body?.message || "").toString().trim().toLowerCase();
  const pickSlot: { start: string; end: string; email?: string } | undefined = body?.pickSlot;

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  // ---- Booking request coming from widget (numeric selection already resolved client-side)
  if (pickSlot) {
    const email = (pickSlot.email || "").trim();
    if (!email) {
      return NextResponse.json({ type: "text", text: "What email should I use for the invite?" });
    }
    try {
      // NOTE: /api/schedule expects {start,end,email}
      const r = await fetch(`${origin}/api/schedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start: pickSlot.start, end: pickSlot.end, email }),
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({} as any));

      if (r.ok && j?.ok) {
        return NextResponse.json({
          type: "booked",
          when: j?.when || "",
          meetLink: j?.meetLink || j?.htmlLink || "",
        });
      }
      const err = j?.error || "Couldn’t book that time. Mind trying another option?";
      return NextResponse.json({ type: "text", text: err });
    } catch {
      return NextResponse.json({ type: "text", text: "Booking failed unexpectedly. Try “book a call” again." });
    }
  }

  // ---- Quick intents
  if (message.includes("pay now") || message === "pay" || message.includes("checkout")) {
    const url = stripeLink();
    if (!url) return txt("Stripe link isn’t configured yet.");
    return NextResponse.json({
      type: "action",
      action: "open_url",
      url,
      text: "You can complete setup here:",
    });
  }

  if (message.includes("price") || message.includes("how much")) {
    return txt("Founders offer: $497 setup + $297/month. Under $10/day to replace an SDR for inbound. I can book a quick call if you’d like.");
  }

  if (message.includes("book") || message.includes("schedule") || message.includes("call")) {
    // Propose next few enabled times as text list
    const url = new URL(`${origin}/api/slots`);
    url.searchParams.set("limit", "12");
    try {
      const r = await fetch(url.toString(), { cache: "no-store" });
      const j = await r.json();
      const enabled: Slot[] = pickFirstEnabled((j?.slots as Slot[]) || [], 4);

      if (!enabled.length) {
        return txt("I’m not seeing open times right now. Try again shortly or tell me a day that works best.");
      }

      const lines = enabled.map((s, i) => `${i + 1}) ${s.label}`);
      const prompt = [
        "Here are a few times (ET):",
        ...lines,
        "",
        "Reply with 1–4, and I’ll send the invite. If I don’t have your email yet, include it too."
      ].join("\n");

      return NextResponse.json({ type: "text", text: prompt, candidates: enabled });
    } catch {
      return txt("Couldn’t load times right now. Please try again.");
    }
  }

  // ---- Default small talk / nudge
  return txt("I can answer questions, book a quick Zoom, or send a checkout link. Try: “pricing”, “book a call”, or “pay now”.");
}
