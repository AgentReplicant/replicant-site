// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

type Role = "user" | "assistant" | "system";
type Msg = { role: Role; content: string };

// ====== CONFIG / ENVs ======
const STRIPE_URL = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || "";
const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";
const BOOKING_RULES_JSON =
  process.env.BOOKING_RULES_JSON ||
  `{"days":[1,2,3,4,5],"startHour":10,"endHour":16,"slotMinutes":30,"minLeadHours":2}`;
const SCHEDULE_API_PATH = "/api/schedule";
const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || "";
const LLM_ENABLED = !!process.env.LLM_ENABLED && !!process.env.OPENAI_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

// ====== HELPERS ======
function parseRules() {
  try {
    return JSON.parse(BOOKING_RULES_JSON);
  } catch {
    return { days: [1, 2, 3, 4, 5], startHour: 10, endHour: 16, slotMinutes: 30, minLeadHours: 2 };
  }
}
function extractEmail(text: string): string | null {
  const m = (text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}
function detectIntent(message: string) {
  const m = (message || "").toLowerCase();
  if (/(pay|checkout|purchase|buy|subscribe|payment|pricing|price)/.test(m)) return "pay";
  if (/(book|schedule|call|meeting|demo|appointment|available times?|options?|when can|pick a time|time slots?)/.test(m)) return "book";
  if (/(email is|my email is|@)/.test(m)) return "email";
  return "unknown";
}

// Robust slot generator: always returns options (falls back if rules exclude all)
function nextSlots(targetCount = 5) {
  const rules = parseRules();
  const { days = [1,2,3,4,5], startHour = 10, endHour = 16, slotMinutes = 30, minLeadHours = 2 } = rules;

  const now = new Date();
  const minLeadMs = minLeadHours * 3600_000;

  const toTZParts = (base: Date, addDays: number) => {
    const t = new Date(base.getTime() + addDays * 86400000);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: BOOKING_TZ, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(t).reduce((acc: any, p) => (acc[p.type] = p.value, acc), {});
    const weekdayNum = new Date(t.toLocaleString("en-US", { timeZone: BOOKING_TZ })).getDay(); // 0..6
    return { y: +parts.year, m: +parts.month, d: +parts.day, weekdayNum };
  };
  const toTZISO = (y:number, m:number, d:number, h:number, min:number) =>
    new Date(Date.UTC(y, m - 1, d, h, min, 0)).toISOString();

  const allowed = Array.isArray(days) && days.length ? days : [1,2,3,4,5];
  const out: { start: string; end: string; label: string }[] = [];

  for (let dayOffset = 0; dayOffset < 7 && out.length < targetCount; dayOffset++) {
    const { y, m, d, weekdayNum } = toTZParts(now, dayOffset);
    const oneBased = ((weekdayNum + 6) % 7) + 1; // Mon=1..Sun=7
    if (!(allowed.includes(weekdayNum) || allowed.includes(oneBased))) continue;

    for (let H = startHour; H < endHour && out.length < targetCount; H++) {
      for (let M = 0; M < 60 && out.length < targetCount; M += slotMinutes) {
        const startISO = toTZISO(y, m, d, H, M);
        const endISO = toTZISO(y, m, d, H, M + slotMinutes);
        if (new Date(startISO).getTime() - now.getTime() < minLeadMs) continue;

        const label = new Date(startISO).toLocaleString("en-US", {
          timeZone: BOOKING_TZ,
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        out.push({ start: startISO, end: endISO, label });
      }
    }
  }

  if (out.length === 0) {
    // Hard fallback: rolling hourly options starting 3h from now
    const seed = new Date(now.getTime() + Math.max(minLeadMs, 3 * 3600_000));
    for (let i = 0; i < targetCount; i++) {
      const s = new Date(seed.getTime() + i * 60 * 60 * 1000);
      const e = new Date(s.getTime() + (parseRules().slotMinutes || 30) * 60 * 1000);
      out.push({
        start: s.toISOString(),
        end: e.toISOString(),
        label: s.toLocaleString("en-US", {
          timeZone: BOOKING_TZ,
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      });
    }
  }
  return out.slice(0, targetCount);
}

// ====== LLM LAYER ======
// We ask the LLM to both answer like a human AND suggest an optional action.
async function llmPlanReply(user: string, history: Msg[] | undefined) {
  if (!LLM_ENABLED) return null;

  const sys =
`You are Replicant’s sales agent. Be concise (1–3 sentences), helpful, and confident.
Goals: answer naturally, qualify lightly, then guide toward either booking a call or paying.
If the user asks for times, pricing, features, objections, comparisons, or support, respond appropriately.
Output strictly in JSON:

{
  "reply": "<natural language to show the user>",
  "action": {"type": "none" | "pay" | "book" | "email", "email": "<optional>"}
}

Rules:
- Prefer "book" when the user hints at meeting or times.
- Prefer "pay" only when the user is ready to purchase.
- Use "email" when the user provides or asks to give an email.
- Never fabricate links; don't mention a payment link unless 'pay' is chosen.`;

  const messages = [
    { role: "system" as Role, content: sys },
    ...(history?.slice(-8) || []),
    { role: "user" as Role, content: user }
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${process.env.OPENAI_API_KEY!}`
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      temperature: 0.5,
      max_tokens: 220,
      messages
    }),
    cache: "no-store"
  });

  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;

  // Try to parse JSON; if the model wrapped it in text, extract the first JSON block.
  const match = raw.match(/\{[\s\S]*\}/);
  const text = match ? match[0] : raw;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.reply === "string" && parsed.action?.type) {
      return parsed as { reply: string; action: { type: "none" | "pay" | "book" | "email"; email?: string } };
    }
  } catch { /* swallow */ }
  // Fallback: treat as plain reply, no action
  return { reply: raw, action: { type: "none" as const } };
}

// ====== ROUTE ======
export async function POST(req: NextRequest) {
  const body = await req.json();
  const history: Msg[] | undefined = body.history;

  // 1) Picking a slot directly
  if ("pickSlot" in body && body.pickSlot?.start && body.pickSlot?.end) {
    const { start, end, email } = body.pickSlot;
    if (!email) {
      return NextResponse.json({
        type: "need_email",
        text: "Got it — what’s the best email for the calendar invite?"
      });
    }
    try {
      const res = await fetch(`${SITE_BASE}${SCHEDULE_API_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start, end, email }),
        cache: "no-store"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Schedule failed");
      const when = new Date(start).toLocaleString("en-US", {
        timeZone: BOOKING_TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
      });
      return NextResponse.json({
        type: "booked",
        text: `All set — you’re booked for ${when}. I’ve emailed the invite.`,
        meetLink: data?.meetLink,
        when
      });
    } catch (e:any) {
      return NextResponse.json({ type: "error", text: `Couldn’t book that slot. Mind trying another?` }, { status: 500 });
    }
  }

  // 2) Email provided
  if ("provideEmail" in body && body.provideEmail?.email) {
    const email = body.provideEmail.email;
    const slots = nextSlots(5);
    return NextResponse.json({ type: "slots", text: "Perfect — pick a time that works:", email, slots });
  }

  // 3) Normal chat message
  const message: string = body.message ?? "";
  const intent = detectIntent(message);

  // First ask the LLM for a plan (natural reply + suggested action)
  const planned = await llmPlanReply(message, history);

  // If LLM is off, or returns nothing, fall back to deterministic intents
  if (!planned) {
    if (intent === "pay" && STRIPE_URL) {
      return NextResponse.json({ type: "action", action: "open_url", url: STRIPE_URL, text: "You can complete payment below." });
    }
    if (intent === "book") {
      const email = extractEmail(message) || undefined;
      const slots = nextSlots(5);
      return NextResponse.json({ type: "slots", text: email ? `Got it (${email}). Pick a time:` : "Happy to book a quick demo — pick a time:", email, slots });
    }
    if (intent === "email") {
      const email = extractEmail(message);
      if (email) {
        const slots = nextSlots(5);
        return NextResponse.json({ type: "slots", text: `Great — I’ll use ${email}. Choose a time:`, email, slots });
      }
    }
    const slots = nextSlots(5);
    return NextResponse.json({ type: "slots", text: "I can book you in or get you set up. Here are some times:", slots });
  }

  // LLM path: send natural reply, then route action if suggested
  const { reply, action } = planned;

  if (action?.type === "pay" && STRIPE_URL) {
    return NextResponse.json({
      type: "action",
      action: "open_url",
      url: STRIPE_URL,
      text: reply || "You can complete payment below."
    });
  }

  if (action?.type === "book") {
    const email = extractEmail(message) || action?.email;
    const slots = nextSlots(5);
    return NextResponse.json({
      type: "slots",
      text: reply || (email ? `Got it (${email}). Pick a time:` : "Pick a time that works:"),
      email,
      slots
    });
  }

  if (action?.type === "email") {
    const email = extractEmail(message) || action?.email;
    if (email) {
      const slots = nextSlots(5);
      return NextResponse.json({
        type: "slots",
        text: reply || `Perfect — I’ll use ${email}. Choose a time:`,
        email,
        slots
      });
    }
  }

  // No action — just reply like a human
  return NextResponse.json({ type: "text", text: reply || "Happy to help — want to book a time or get started now?" });
}
