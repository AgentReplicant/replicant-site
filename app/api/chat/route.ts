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
  try { return JSON.parse(BOOKING_RULES_JSON); }
  catch { return { days:[1,2,3,4,5], startHour:10, endHour:16, slotMinutes:30, minLeadHours:2 }; }
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

function toTZ(date: Date) {
  return new Date(date.toLocaleString("en-US", { timeZone: BOOKING_TZ }));
}
function isoAt(y:number,m:number,d:number,h:number,min:number) {
  return new Date(Date.UTC(y, m-1, d, h, min, 0)).toISOString();
}
function fmtLabel(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: BOOKING_TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  });
}
function slotsForDate(y:number,m:number,d:number, page=0) {
  const { startHour=10, endHour=16, slotMinutes=30, minLeadHours=2 } = parseRules();
  const now = new Date();
  const minLeadMs = minLeadHours*3600_000;

  const all: { start:string; end:string; label:string }[] = [];
  for (let H=startHour; H<endHour; H++) {
    for (let M=0; M<60; M+=slotMinutes) {
      const s = isoAt(y,m,d,H,M);
      const e = isoAt(y,m,d,H,M+slotMinutes);
      if (new Date(s).getTime() - now.getTime() < minLeadMs) continue;
      all.push({ start:s, end:e, label: fmtLabel(s) });
    }
  }
  const pageSize = 5;
  const startIdx = page*pageSize;
  return { slots: all.slice(startIdx, startIdx+pageSize), total: all.length };
}
function nextWorkingDayWithSlots(y:number,m:number,d:number, max=14) {
  const rules = parseRules();
  const allowed = rules.days?.length ? rules.days : [1,2,3,4,5];
  const base = toTZ(new Date(Date.UTC(y, m-1, d, 12, 0, 0)));
  for (let i=0;i<=max;i++){
    const cand = new Date(base.getTime()+i*86400000);
    const oneBased = ((cand.getDay()+6)%7)+1;
    if (!(allowed.includes(cand.getDay()) || allowed.includes(oneBased))) continue;
    const { slots } = slotsForDate(cand.getFullYear(), cand.getMonth()+1, cand.getDate(), 0);
    if (slots.length) return { y:cand.getFullYear(), m:cand.getMonth()+1, d:cand.getDate() };
  }
  return null;
}

// LLM: answer naturally; never promise bookings; never auto-open scheduler
async function llmPlanReply(user: string, history: Msg[] | undefined) {
  if (!LLM_ENABLED) return null;

  const sys = `You are Replicant’s sales agent. Be concise (1–3 sentences), helpful, and confident.
Answer questions first. If the user seems ready, you MAY suggest next steps (book/pay),
but DO NOT assume they want to schedule. Do NOT claim anything is booked.
Return STRICT JSON only:
{"reply":"<text>","action":{"type":"none|pay|book|email","email":"<optional>"}}`;

  const messages = [
    { role: "system" as Role, content: sys },
    ...(history?.slice(-8) || []),
    { role: "user" as Role, content: user }
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${process.env.OPENAI_API_KEY!}` },
    body: JSON.stringify({ model: LLM_MODEL, temperature: 0.5, max_tokens: 220, messages }),
    cache: "no-store"
  });

  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;
  const m = raw.match(/\{[\s\S]*\}/);
  try { return JSON.parse(m ? m[0] : raw); } catch { return { reply: raw, action: { type: "none" as const } }; }
}

// ====== ROUTE ======
export async function POST(req: NextRequest) {
  const body = await req.json();
  const history: Msg[] | undefined = body.history;
  const filters = body.filters || {};
  const date = filters.date as { y:number, m:number, d:number } | undefined;
  const page = typeof filters.page === "number" ? filters.page : 0;

  // Picked a slot → book
  if ("pickSlot" in body && body.pickSlot?.start && body.pickSlot?.end) {
    const { start, end, email } = body.pickSlot;
    if (!email) return NextResponse.json({ type: "need_email", text: "What’s the best email for the calendar invite?" });
    try {
      const res = await fetch(`${SITE_BASE}${SCHEDULE_API_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start, end, email }),
        cache: "no-store"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Schedule failed");
      const when = fmtLabel(start);
      return NextResponse.json({ type: "booked", text: `Booked — you’re on the calendar for ${when}. I’ve emailed the invite.`, meetLink: data?.meetLink, when });
    } catch {
      return NextResponse.json({ type: "error", text: `Couldn’t book that slot. Mind trying another?` }, { status: 500 });
    }
  }

  // Provided email → if a date exists, show that day; else ask for day (client decides when to open UI)
  if ("provideEmail" in body && body.provideEmail?.email) {
    const email = body.provideEmail.email;
    if (date) {
      const { slots, total } = slotsForDate(date.y, date.m, date.d, page);
      if (!slots.length) {
        const nxt = nextWorkingDayWithSlots(date.y, date.m, date.d);
        if (nxt) {
          const { slots: s2 } = slotsForDate(nxt.y, nxt.m, nxt.d, 0);
          return NextResponse.json({ type: "slots", text: "No openings that day — here’s the next available:", email, slots: s2, date: nxt, total });
        }
      }
      return NextResponse.json({ type: "slots", text: "Great — pick a time that works:", email, slots, date, total });
    }
    return NextResponse.json({ type: "ask_day", text: "Got it — which day works for you?" });
  }

  // Normal chat
  const message: string = body.message ?? "";
  const intent = detectIntent(message);

  // Deterministic: pay
  if (intent === "pay" && STRIPE_URL) {
    return NextResponse.json({ type: "action", action: "open_url", url: STRIPE_URL, text: "You can complete payment below." });
  }

  // Deterministic: booking (only when the user asked)
  if (intent === "book") {
    // if we already have a date from the client, show times; else ask for day
    if (date) {
      const { slots, total } = slotsForDate(date.y, date.m, date.d, page);
      if (!slots.length) {
        const nxt = nextWorkingDayWithSlots(date.y, date.m, date.d);
        if (nxt) {
          const { slots: s2 } = slotsForDate(nxt.y, nxt.m, nxt.d, 0);
          return NextResponse.json({ type: "slots", text: "No openings that day — here’s the next available:", slots: s2, date: nxt, total });
        }
      }
      return NextResponse.json({ type: "slots", text: "Pick a time that works:", slots, date, total });
    }
    return NextResponse.json({ type: "ask_day", text: "Which day works for you?" });
  }

  // LLM: answer questions; if it suggests booking, we’ll just tell the client to show a small chip
  const planned = await llmPlanReply(message, history);
  if (!planned) {
    return NextResponse.json({ type: "text", text: "Happy to help. Ask me anything; when you’re ready, I can show available days and times." });
  }

  const { reply, action } = planned;

  if (action?.type === "pay" && STRIPE_URL) {
    return NextResponse.json({ type: "action", action: "open_url", url: STRIPE_URL, text: reply || "You can complete payment below." });
  }
  if (action?.type === "book") {
    // do NOT open the scheduler automatically; the widget will show a tiny chip
    return NextResponse.json({ type: "text", text: reply || "If you’d like, I can show available times." });
  }
  if (action?.type === "email") {
    const email = extractEmail(message) || action?.email;
    if (email) return NextResponse.json({ type: "ask_day", text: `Thanks — I’ll use ${email}. Which day works for you?`, email });
  }

  return NextResponse.json({ type: "text", text: reply || "Got it — when you’re ready, I can show available times." });
}
