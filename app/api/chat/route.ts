// app/api/chat/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Msg = { role: "agent" | "user"; text: string };

function normalize(s: string) {
  return (s || "").toLowerCase();
}

export async function POST(req: Request) {
  const { input, history = [] as Msg[] } = await req.json().catch(() => ({}));
  const text: string = (input || "").toString().trim();

  if (!text) {
    return NextResponse.json({ reply: "Say something like: 'book a call' or 'pay'." });
  }

  const payUrl =
    process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ||
    process.env.STRIPE_PAYMENT_LINK ||
    "https://example.com/pay";

  // (Optional) show hours pulled from your env BOOKING_RULES_JSON
  let hours = "Wed/Thu all day, or 4:30–7:30pm other days.";
  try {
    const rules = JSON.parse(process.env.BOOKING_RULES_JSON || "{}");
    if (rules && rules.slotMinutes) {
      hours = "I can offer Wednesday/Thursday all day, and 4:30–7:30pm other days.";
    }
  } catch {}

  const t = normalize(text);

  if (t.includes("pay") || t.includes("checkout")) {
    return NextResponse.json({
      reply: `Here’s the checkout link: ${payUrl}\n\nOnce you pay I’ll send onboarding next.`,
    });
  }

  if (t.includes("book") || t.includes("call") || t.includes("schedule")) {
    return NextResponse.json({
      reply:
        `Great — I can book you. ${hours}\n` +
        `Reply with a time (“Wed 5pm”) or say “send the link” to get the checkout.`,
    });
  }

  // Simple fallback (you can add more patterns here)
  return NextResponse.json({
    reply:
      "I can qualify you, book a call, or send a payment link.\n" +
      "Try: “book a call” or “pay”.",
  });
}
