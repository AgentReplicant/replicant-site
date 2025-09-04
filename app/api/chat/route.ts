// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const STRIPE_URL = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || "";
const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";
const BOOKING_RULES_JSON =
  process.env.BOOKING_RULES_JSON ||
  `{"days":[1,2,3,4,5],"startHour":10,"endHour":16,"slotMinutes":30,"minLeadHours":2}`;
const SCHEDULE_API_PATH = "/api/schedule";

// --- Helpers ---
function normalize(s: string) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}
function detectIntent(message: string) {
  const m = normalize(message);
  if (/(pay|checkout|purchase|buy|subscribe|payment|pricing|price)/.test(m)) return "pay";
  if (/(book|schedule|call|meeting|demo|appointment|available times?|options?|when can|pick a time|time slots?)/.test(m)) return "book";
  if (/(email is|my email is|@)/.test(m)) return "email";
  return "unknown";
}
function parseRules() {
  try { return JSON.parse(BOOKING_RULES_JSON); }
  catch { return { days:[1,2,3,4,5], startHour:10, endHour:16, slotMinutes:30, minLeadHours:2 }; }
}
function extractEmail(text: string): string | null {
  const m = (text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}

// Robust slot generator (guarantees options, respects rules when possible)
function nextSlots(targetCount = 5) {
  const rules = parseRules();
  const {
    days = [1, 2, 3, 4, 5],            // 1=Mon..7=Sun or 0=Sun..6=Sat (we accept both)
    startHour = 10,
    endHour = 16,
    slotMinutes = 30,
    minLeadHours = 2,
  } = rules;

  const now = new Date();
  const minLeadMs = minLeadHours * 3600_000;

  const toTZPieces = (base: Date, addDays: number) => {
    const target = new Date(base.getTime() + addDays * 86400000);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: BOOKING_TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short"
    }).formatToParts(target).reduce((acc: any, p) => (acc[p.type] = p.value, acc), {});
    const weekdayNum = new Date(target.toLocaleString("en-US", { timeZone: BOOKING_TZ })).getDay(); // 0..6 Sun..Sat
    return { y: +parts.year, m: +parts.month, d: +parts.day, weekdayNum };
  };
  const toTZISO = (y:number, m:number, d:number, h:number, min:number) => new Date(Date.UTC(y, m-1, d, h, min, 0)).toISOString();

  const allowed = Array.isArray(days) && days.length ? days : [1,2,3,4,5];

  const out: { start: string; end: string; label: string }[] = [];
  for (let dayOffset=0; dayOffset<7 && out.length<targetCount; dayOffset++) {
    const { y, m, d, weekdayNum } = toTZPieces(now, dayOffset);
    // accept both 0..6 and 1..7 encodings
    const oneBased = ((weekdayNum + 6) % 7) + 1; // Mon=1..Sun=7
    if (!(allowed.includes(weekdayNum) || allowed.includes(oneBased))) continue;

    for (let H=startHour; H<endHour && out.length<targetCount; H++) {
      for (let M=0; M<60 && out.length<targetCount; M+=slotMinutes) {
        const startISO = toTZISO(y,m,d,H,M);
        const endISO   = toTZISO(y,m,d,H,M+slotMinutes);
        if (new Date(startISO).getTime() - now.getTime() < minLeadMs) continue;
        const label = new Date(startISO).toLocaleString("en-US", {
          timeZone: BOOKING_TZ, weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit"
        });
        out.push({ start:startISO, end:endISO, label });
      }
    }
  }

  // Hard fallback if nothing matched rules
  if (out.length === 0) {
    const seed = new Date(now.getTime() + Math.max(minLeadMs, 3 * 3600_000));
    for (let i=0; i<targetCount; i++) {
      const s = new Date(seed.getTime() + i * 60 * 60 * 1000);
      const e = new Date(s.getTime() + slotMinutes * 60 * 1000);
      out.push({
        start: s.toISOString(),
        end: e.toISOString(),
        label: s.toLocaleString("en-US", {
          timeZone: BOOKING_TZ, weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit"
        }),
      });
    }
  }

  return out.slice(0, targetCount);
}

// Optional LLM stylist: rewrites deterministic messages in a human tone
async function maybeRewrite(text: string, personaId?: string, history?: ChatMessage[]) {
  if (!process.env.LLM_ENABLED || !process.env.OPENAI_API_KEY) return text;
  try {
    const persona = {
      alex: "neutral, professional, concise",
      riley: "friendly, energetic, upbeat",
      jordan: "direct, ROI-driven, confident",
      sora: "calm, helpful, reassuring",
    } as Record<string,string>;
    const tone = persona[personaId || "alex"] || persona.alex;

    const sys = `You are an AI sales/booking agent. Keep replies brief (1-2 lines), inviting, and human. Tone: ${tone}.
Never invent links or commitments. If times are offered, mention “pick a time below”.
If payment is offered, mention “secure checkout below”. Keep it conversational.`;

    const messages = [
      { role: "system", content: sys },
      ...(history?.slice(-6) || []),
      { role: "user", content: `Rewrite this reply naturally, same meaning:\n"""${text}"""` },
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || "gpt-4o-mini",
        temperature: 0.6,
        max_tokens: 120,
        messages,
      }),
      cache: "no-store",
    });
    const json = await res.json();
    const out = json?.choices?.[0]?.message?.content?.trim();
    return out || text;
  } catch {
    return text; // fail safe
  }
}

// --- Route ---
export async function POST(req: NextRequest) {
  const body = await req.json();
  const personaId: string | undefined = body.personaId;
  const history: ChatMessage[] | undefined = body.history;

  // 1) Slot picked
  if ("pickSlot" in body && body.pickSlot?.start && body.pickSlot?.end) {
    const { start, end, email } = body.pickSlot;
    if (!email) {
      const t = await maybeRewrite("Great — what’s the best email to send the invite to?", personaId, history);
      return NextResponse.json({ type: "need_email", text: t });
    }
    try {
      const base = process.env.NEXT_PUBLIC_SITE_URL || "";
      const res = await fetch(`${base}${SCHEDULE_API_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start, end, email }),
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Schedule failed");
      const whenLabel = new Date(start).toLocaleString("en-US", {
        timeZone: BOOKING_TZ, weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit"
      });
      const t = await maybeRewrite(`All set — you’re booked for ${whenLabel}. I’ve emailed the invite.`, personaId, history);
      return NextResponse.json({ type: "booked", text: t, meetLink: data?.meetLink, when: whenLabel });
    } catch (e:any) {
      const t = await maybeRewrite(`I couldn't book that slot. Mind trying a different time?`, personaId, history);
      return NextResponse.json({ type: "error", text: t }, { status: 500 });
    }
  }

  // 2) Email provided
  if ("provideEmail" in body && body.provideEmail?.email) {
    const email = body.provideEmail.email;
    const slots = nextSlots(5);
    const t = await maybeRewrite("Thanks! Pick a time that works:", personaId, history);
    return NextResponse.json({ type: "slots", text: t, email, slots });
  }

  // 3) Plain message
  const message: string = body.message ?? "";
  const intent = detectIntent(message);

  if (intent === "pay" && STRIPE_URL) {
    const t = await maybeRewrite("You can complete payment below. I’ll confirm once it clears.", personaId, history);
    return NextResponse.json({ type: "action", action: "open_url", url: STRIPE_URL, text: t });
  }

  if (intent === "book") {
    const email = extractEmail(message) || undefined;
    const slots = nextSlots(5);
    const baseText = email ? `Got it (${email}). Pick a time below:` : "Happy to book a quick demo — pick a time below:";
    const t = await maybeRewrite(baseText, personaId, history);
    return NextResponse.json({ type: "slots", text: t, email, slots });
  }

  if (intent === "email") {
    const email = extractEmail(message);
    if (email) {
      const slots = nextSlots(5);
      const t = await maybeRewrite(`Perfect — I’ll use ${email}. Choose a time below:`, personaId, history);
      return NextResponse.json({ type: "slots", text: t, email, slots });
    }
  }

  // Friendly default: offer times (less “bot”)
  const slots = nextSlots(5);
  const t = await maybeRewrite("I can book you in or get you set up. Here are some times:", personaId, history);
  return NextResponse.json({ type: "slots", text: t, slots });
}
