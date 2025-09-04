// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

type Role = "user" | "assistant" | "system";
type Msg = { role: Role; content: string };

// ====== CONFIG ======
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

// IMPORTANT: do NOT treat generic “appointment(s)” as booking intent.
// Only explicit “book / schedule / call / meeting / demo / time / slot”
function detectIntent(message: string) {
  const m = (message || "").toLowerCase();
  if (/(pay|checkout|purchase|buy|subscribe|payment|pricing|price)/.test(m)) return "pay";
  if (/(book|schedule|call|meeting|demo|pick a time|time slots?|see (available )?times?)/.test(m)) return "book";
  if (/(email is|my email is|@)/.test(m)) return "email";
  return "unknown";
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
      if (new Date(s).getTime() - now.getTime() < minLeadMs) continue;
      const e = isoAt(y,m,d,H,M+slotMinutes);
      all.push({ start:s, end:e, label: fmtLabel(s) });
    }
  }
  const pageSize = 5;
  const startIdx = page*pageSize;
  return { slots: all.slice(startIdx, startIdx+pageSize), total: all.length };
}

function nextWorkingDayWithSlots(y:number,m:number,d:number, max=14) {
  const rules = parseRules();
  const allowed = rules.days?.length ? rules.days : [1,2,3,4,5]; // accept 1..7 or 0..6
  const base = new Date(Date.UTC(y, m-1, d, 12, 0, 0));
  for (let i=0;i<=max;i++){
    const cand = new Date(base.getTime()+i*86400000);
    const oneBased = ((cand.getUTCDay()+6)%7)+1;
    // treat both representations as allowed
    if (!(allowed.includes(cand.getUTCDay()) || allowed.includes(oneBased))) continue;
    const { slots } = slotsForDate(cand.getUTCFullYear(), cand.getUTCMonth()+1, cand.getUTCDate(), 0);
    if (slots.length) return { y:cand.getUTCFullYear(), m:cand.getUTCMonth()+1, d:cand.getUTCDate() };
  }
  return null;
}

// LLM: answer naturally; suggest next steps; never promise bookings.
async function llmPlanReply(user: string, history: Msg[] | undefined) {
  if (!LLM_ENABLED) return null;

  const sys = `You are Replicant’s sales agent. Be concise (1–3 sentences), helpful, and confident.
Answer questions first. If appropriate, OFFER next steps (book/pay), but do not assume.
Never claim anything is booked. Return STRICT JSON:
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

  // Picked slot → book
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

  // Provided email
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
    // don’t spam “which day works” here; the client will show a small chip
    return NextResponse.json({ type: "text", text: "Thanks! When you’re ready, I can show available days to book." , email });
  }

  // Normal chat
  const message: string = body.message ?? "";
  const intent = detectIntent(message);

  // Deterministic: pay
  if (intent === "pay" && STRIPE_URL) {
    return NextResponse.json({ type: "action", action: "open_url", url: STRIPE_URL, text: "You can complete payment below." });
  }

  // Deterministic: booking only when explicitly asked
  if (intent === "book") {
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

  // LLM: answer normally; may *suggest* next steps
  const planned = await llmPlanReply(message, history);
  if (!planned) {
    return NextResponse.json({ type: "text", text: "Happy to help. Ask me anything; when you’re ready, I can show available days and times." });
  }

  const { reply, action } = planned;

  if (action?.type === "pay" && STRIPE_URL) {
    return NextResponse.json({ type: "action", action: "open_url", url: STRIPE_URL, text: reply || "You can complete payment below." });
  }
  if (action?.type === "book") {
    // Do NOT open scheduler here; client will just show a subtle chip.
    return NextResponse.json({ type: "text", text: reply || "If you’d like, I can show available times." });
  }
  if (action?.type === "email") {
    const email = extractEmail(message) || action?.email;
    if (email) return NextResponse.json({ type: "text", text: `Thanks — I’ll use ${email}. Say “show times” when you want to book.`, email });
  }

  return NextResponse.json({ type: "text", text: reply || "Got it — when you’re ready, I can show available times." });
}
