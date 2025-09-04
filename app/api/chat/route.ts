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
  if (/(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\bmon\b|\btue\b|\bwed\b|\bthu\b|\bfri\b|\bsat\b|\bsun\b)/.test(m)) return "book";
  return "unknown";
}

function toTZ(date: Date) {
  // convert a JS Date to the same wall clock time inside BOOKING_TZ for formatting
  return new Date(date.toLocaleString("en-US", { timeZone: BOOKING_TZ }));
}

function isoAt(y:number,m:number,d:number,h:number,min:number) {
  // Construct ISO by treating y/m/d/h/min as local time in BOOKING_TZ
  return new Date(Date.UTC(y, m-1, d, h, min, 0)).toISOString();
}

function fmtLabel(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: BOOKING_TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  });
}

function getYMDInTZ(base: Date, addDays=0) {
  const t = new Date(base.getTime() + addDays*86400000);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: BOOKING_TZ, year:"numeric", month:"2-digit", day:"2-digit" })
    .formatToParts(t).reduce((a:any,p)=> (a[p.type]=p.value,a),{});
  const wall = toTZ(t);
  return { y:+parts.year, m:+parts.month, d:+parts.day, dow: wall.getDay() as 0|1|2|3|4|5|6 };
}

// exact-date slots for Y/M/D; with paging over that same day
function slotsForDate(y:number,m:number,d:number, page=0) {
  const rules = parseRules();
  const { startHour=10, endHour=16, slotMinutes=30, minLeadHours=2 } = rules;
  const now = new Date();
  const minLeadMs = minLeadHours*3600_000;

  const startIndex = page * Math.max(1, Math.floor((60/(slotMinutes||30))* (endHour-startHour) / 2)); // simple paging chunk
  const results: { start:string; end:string; label:string }[] = [];

  // build the entire day’s slots, then slice a page
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
  for (let i=startIndex; i<all.length && results.length<pageSize; i++) results.push(all[i]);

  return { slots: results, total: all.length };
}

// next-available working day if chosen day has no slots
function nextWorkingDayWithSlots(y:number,m:number,d:number, maxSearchDays=14) {
  const rules = parseRules();
  const allowed = rules.days?.length ? rules.days : [1,2,3,4,5]; // accept 1..7 or 0..6
  const target = toTZ(new Date(Date.UTC(y, m-1, d, 12, 0, 0))); // midday
  for (let i=0;i<=maxSearchDays;i++){
    const cand = new Date(target.getTime() + i*86400000);
    const oneBased = ((cand.getDay()+6)%7)+1;
    if (!(allowed.includes(cand.getDay()) || allowed.includes(oneBased))) continue;
    const { slots } = slotsForDate(cand.getFullYear(), cand.getMonth()+1, cand.getDate(), 0);
    if (slots.length>0) return { y:cand.getFullYear(), m:cand.getMonth()+1, d:cand.getDate() };
  }
  return null;
}

// LLM: plan + reply (never promises bookings)
async function llmPlanReply(user: string, history: Msg[] | undefined) {
  if (!LLM_ENABLED) return null;

  const sys = `You are Replicant’s sales agent. Be concise (1–3 sentences), helpful, and confident.
Answer normally, handle objections; propose booking or payment only when appropriate.
Return STRICT JSON only:
{"reply":"<text>","action":{"type":"none|pay|book|email","email":"<optional>"}} 
Rules: never claim anything is booked; for "book", invite them to pick a day or time below; never invent links.`;

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

  // 0) Slot picked → real booking
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

  // 1) Email provided → if a date is selected, show times for that date; otherwise ask for a day
  if ("provideEmail" in body && body.provideEmail?.email) {
    const email = body.provideEmail.email;
    if (date) {
      const { slots, total } = slotsForDate(date.y, date.m, date.d, page);
      if (slots.length === 0) {
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

  // 2) Normal chat with intent + readiness short-circuit
  const message: string = body.message ?? "";
  const intent = detectIntent(message);

  // Pay always deterministic
  if (intent === "pay" && STRIPE_URL) {
    return NextResponse.json({ type: "action", action: "open_url", url: STRIPE_URL, text: "You can complete payment below." });
  }

  // Booking intent → if no day selected yet, ask day; if day selected, show that day’s times
  if (intent === "book") {
    const email = extractEmail(message) || undefined;
    // If the client sent a date (user picked a day), return times for that date
    if (date) {
      const { slots, total } = slotsForDate(date.y, date.m, date.d, page);
      if (slots.length === 0) {
        const nxt = nextWorkingDayWithSlots(date.y, date.m, date.d);
        if (nxt) {
          const { slots: s2 } = slotsForDate(nxt.y, nxt.m, nxt.d, 0);
          return NextResponse.json({ type: "slots", text: "No openings that day — here’s the next available:", email, slots: s2, date: nxt, total });
        }
      }
      return NextResponse.json({ type: "slots", text: email ? `Got it (${email}). Pick a time:` : "Pick a time that works:", email, slots, date, total });
    }
    // No date yet → ask for a day
    return NextResponse.json({ type: "ask_day", text: "Happy to set something up — which day works for you?" });
  }

  // Otherwise, let LLM answer; only suggest next steps, don’t force booking
  const planned = await llmPlanReply(message, history);
  if (!planned) {
    return NextResponse.json({ type: "text", text: "Happy to help. Ask me anything, and say “book a call” when you’re ready." });
  }

  const { reply, action } = planned;

  if (action?.type === "pay" && STRIPE_URL) {
    return NextResponse.json({ type: "action", action: "open_url", url: STRIPE_URL, text: reply || "You can complete payment below." });
  }
  if (action?.type === "book") {
    // Move user to day selection first
    return NextResponse.json({ type: "ask_day", text: reply || "Sure — which day works for you?" });
  }
  if (action?.type === "email") {
    const email = extractEmail(message) || action?.email;
    if (email) return NextResponse.json({ type: "ask_day", text: `Thanks — I’ll use ${email}. Which day works for you?`, email });
  }

  return NextResponse.json({ type: "text", text: reply || "Got it — when you’re ready, I can show available days and times." });
}
