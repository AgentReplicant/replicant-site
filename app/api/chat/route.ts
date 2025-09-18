// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HistMsg = { role: "user" | "assistant"; content: string };
type Filters = { date?: { y: number; m: number; d: number }; page?: number };

const STRIPE_LINK =
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || process.env.STRIPE_PAYMENT_LINK || "";

function lastUser(history: HistMsg[] = []) {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") return history[i].content.toLowerCase();
  }
  return "";
}

function has(msg: string, list: (string | RegExp)[]) {
  return list.some((k) => (typeof k === "string" ? msg.includes(k) : k.test(msg)));
}

function pricingBlurb() {
  return (
    "launch pricing is $497 setup + $297/mo. 14-day refund on the first month. " +
    "cancel any time after."
  );
}

function supportHow() {
  return (
    "support agent: answers FAQs in your brand voice, asks clarifying questions when needed, " +
    "and escalates to a human for edge cases. you get transcripts and contact info."
  );
}

function bookingHow() {
  return (
    "booking agent: asks for preferred day, shows real availability, confirms, and sends the invite. " +
    "if you prefer phone calls, we collect a number and confirm the call instead of video."
  );
}

function salesHow() {
  return (
    "sales agent: qualifies for intent, timing, and budget, answers objections, and—when asked—drops " +
    "your checkout link. tough cases hand off to a human cleanly."
  );
}

function channelsBlurb() {
  return "channels: web chat today; instagram, whatsapp, and sms are next on the rollout.";
}

function guaranteeBlurb() {
  return "guarantee: 14-day refund on the first month.";
}

function roiCompare() {
  // Very simple: federal minimum wage vs 24/7 coverage.
  const federal = 7.25; // $/hr
  const hoursMonth = 24 * 30; // rough
  const wageMonthly = federal * hoursMonth; // ~$5.2k
  return (
    `even at federal minimum wage ($${federal.toFixed(2)}/hr), ` +
    `24/7 coverage costs about $${Math.round(wageMonthly).toLocaleString()}/mo before taxes/benefits. ` +
    `replicant is $297/mo + setup, and it never sleeps.`
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const history: HistMsg[] = Array.isArray(body?.history) ? body.history : [];
  const message: string = (body?.message || "").toLowerCase();
  const filters: Filters | undefined = body?.filters;

  const say = (text: string) => NextResponse.json({ type: "text", text });

  // --- explicit actions ---
  if (has(message, [/checkout|pay now|pay|buy|sign ?up/])) {
    if (!STRIPE_LINK) return say("i can set you up—stripe link isn’t configured yet.");
    return NextResponse.json({
      type: "action",
      action: "open_url",
      url: STRIPE_LINK,
      text: "here’s a secure checkout link:",
    });
  }

  // ask for a real person → book a call (day-first)
  if (has(message, [/talk to (a )?(human|person|rep|agent)/, /book (a )?call/, /speak to (someone|a person)/])) {
    // if we already have a date filter, return slots
    if (filters?.date) {
      // fetch real slots
      const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
      const { y, m, d } = filters.date;
      const url = new URL(`${origin}/api/slots`);
      url.searchParams.set("y", String(y));
      url.searchParams.set("m", String(m).padStart(2, "0"));
      url.searchParams.set("d", String(d).padStart(2, "0"));
      url.searchParams.set("limit", "6");
      url.searchParams.set("page", String(Number(filters?.page ?? 0)));
      try {
        const r = await fetch(url.toString(), { cache: "no-store" });
        const j = await r.json().catch(() => ({} as any));
        const slots = Array.isArray(j?.slots) ? j.slots : [];
        return NextResponse.json({
          type: "slots",
          text: "here are a few times (ET):",
          date: filters.date,
          total: slots.length,
          slots,
        });
      } catch {
        return say("couldn’t load times right now—mind trying again?");
      }
    }
    // otherwise ask for a day (your widget understands natural days)
    return say("sure—what day works for you? (type today, tomorrow, or a weekday)");
  }

  // --- information & objections ---
  if (has(message, [/price|pricing|cost/])) {
    return say(pricingBlurb());
  }
  if (has(message, [/guarantee|refund|cancel/])) {
    return say(guaranteeBlurb());
  }
  if (has(message, [/channel|instagram|ig|whatsapp|wa|sms/])) {
    return say(channelsBlurb());
  }
  if (has(message, [/roi|worth|expensive|too much|afford|compare|employee|wage|hire/])) {
    return say(`${pricingBlurb()} ${roiCompare()}`);
  }

  // how it works by use case
  if (has(message, [/support/])) return say(supportHow());
  if (has(message, [/book|schedule|appointment/])) return say(bookingHow());
  if (has(message, [/sale|sell|lead|qualif/])) return say(salesHow());

  // when they ask “how does it work?”
  if (has(message, [/how .*work|what .*do|explain|tell me more/])) {
    return say(
      "replicant runs three agent types you can turn on together or separately: " +
        "support (answers FAQs + escalates), booking (asks day → offers times → confirms), " +
        "and sales (qualifies, handles objections, and drops checkout when asked). " +
        "what do you want to start with—support, booking, or sales?"
    );
  }

  // if they ask directly “are you ai?”
  if (has(message, [/are you (an )?ai|bot|real/i])) {
    return say("i’m part of the replicant team. if you’d prefer a human, say “talk to a real person”.");
  }

  // default: be helpful & nudge to next step
  const last = lastUser(history);
  if (!last || has(last, [/^hi$|^hey$|hello/])) {
    return say("hi—happy to help. what are you trying to solve first: support, booking, or sales?");
  }
  // generic helpful nudge
  return say("got it. want me to explain how we’d handle support, booking, or sales for your business?");
}
