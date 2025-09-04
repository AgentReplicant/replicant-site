// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

type Role = "user" | "assistant" | "system";
type Msg = { role: Role; content: string };

const STRIPE_URL = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || "";
const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";
const BOOKING_RULES_JSON =
  process.env.BOOKING_RULES_JSON ||
  `{"days":[1,2,3,4,5],"startHour":10,"endHour":16,"slotMinutes":30,"minLeadHours":2}`;
const SCHEDULE_API_PATH = "/api/schedule";
const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || "";
const LLM_ENABLED = !!process.env.LLM_ENABLED && !!process.env.OPENAI_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

// ---------- helpers ----------
function parseRules() {
  try { return JSON.parse(BOOKING_RULES_JSON); }
  catch { return { days:[1,2,3,4,5], startHour:10, endHour:16, slotMinutes:30, minLeadHours:2 }; }
}
function tzNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: BOOKING_TZ }));
}
function isoAt(y:number,m:number,d:number,h:number,min:number) {
  return new Date(Date.UTC(y, m-1, d, h, min, 0)).toISOString();
}
function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: BOOKING_TZ, weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit"
  });
}
function extractEmail(t: string) {
  const m = (t||"").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}
function latestEmail(history?: Msg[]) {
  if (!history) return null;
  for (let i=history.length-1;i>=0;i--) {
    const e = extractEmail(history[i].content);
    if (e) return e;
  }
  return null;
}

// day parsing
function parseDay(message: string): { y:number,m:number,d:number } | null {
  const m = (message||"").toLowerCase();
  const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const abbr = ["sun","mon","tue","wed","thu","fri","sat"];
  const now = tzNow();
  if (/\btoday\b/.test(m)) return { y: now.getFullYear(), m: now.getMonth()+1, d: now.getDate() };
  if (/\btomorrow\b/.test(m)) {
    const t = new Date(now.getTime()+86400000);
    return { y:t.getFullYear(), m:t.getMonth()+1, d:t.getDate() };
  }
  let want: number | null = null;
  for (let i=0;i<7;i++) if (m.includes(days[i]) || m.match(new RegExp(`\\b${abbr[i]}\\b`))) { want = i; break; }
  if (want===null) return null;
  for (let add=1; add<=14; add++) {
    const cand = new Date(now.getTime()+add*86400000);
    if (cand.getDay()===want) return { y:cand.getFullYear(), m:cand.getMonth()+1, d:cand.getDate() };
  }
  return null;
}
// time parsing
function parseTime(message: string): { h:number, min:number } | null {
  const m = (message||"").toLowerCase();
  const r = /(?:\b|@)(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/;
  const a = m.match(r);
  if (!a) return null;
  let h = parseInt(a[1],10); let min = a[2]?parseInt(a[2],10):0; const ap=a[3];
  if (ap==="pm" && h<12) h+=12; if (ap==="am" && h===12) h=0;
  return { h, min };
}

function detectIntent(message: string) {
  const m = (message || "").toLowerCase();

  if (/\b(price|pricing|cost|how much|monthly|per month)\b/.test(m)) return "pricing";
  if (/(whatsapp|instagram).*appoint|auto.*book|automatic.*appoint|from instagram|from whatsapp/.test(m)) return "capability";

  // **Less aggressive payment** — only explicit purchase intent
  if (/\b(pay now|pay|\bcheckout\b|sign ?up|subscribe|buy)\b/.test(m)) return "pay";

  if (parseDay(message) && parseTime(message)) return "book_exact";
  if (/\b(book|schedule|call|meeting|demo|pick a time|time slots?|see (available )?times?)\b/.test(m)) return "book";
  if (parseDay(message) && !parseTime(message)) return "book";

  if (/(email is|my email is|@)/.test(m)) return "email";
  return "unknown";
}

function slotsForDate(y:number,m:number,d:number, page=0) {
  const { startHour=10, endHour=16, slotMinutes=30, minLeadHours=2 } = parseRules();
  const now = tzNow();
  const minLeadMs = minLeadHours*3600_000;
  const all: { start:string; end:string; label:string }[] = [];
  for (let H=startHour; H<endHour; H++) {
    for (let M=0; M<60; M+=slotMinutes) {
      const s = isoAt(y,m,d,H,M);
      if (new Date(s).getTime() - now.getTime() < minLeadMs) continue;
      const e = isoAt(y,m,d,H,M+slotMinutes);
      all.push({ start:s, end:e, label: fmt(s) });
    }
  }
  const pageSize = 5;
  const startIdx = page*pageSize;
  return { slots: all.slice(startIdx, startIdx+pageSize), all, total: all.length, slotMinutes };
}

function nextWorkingDayWithSlots(y:number,m:number,d:number, max=14) {
  const rules = parseRules();
  const allowed = rules.days?.length ? rules.days : [1,2,3,4,5];
  const base = new Date(Date.UTC(y, m-1, d, 12, 0, 0));
  for (let i=0;i<=max;i++){
    const cand = new Date(base.getTime()+i*86400000);
    const oneBased = ((cand.getUTCDay()+6)%7)+1;
    if (!(allowed.includes(cand.getUTCDay()) || allowed.includes(oneBased))) continue;
    const { slots } = slotsForDate(cand.getUTCFullYear(), cand.getUTCMonth()+1, cand.getUTCDate(), 0);
    if (slots.length) return { y:cand.getUTCFullYear(), m:cand.getUTCMonth()+1, d:cand.getUTCDate() };
  }
  return null;
}

async function tryBookExact(date: {y:number,m:number,d:number}, hm: {h:number,min:number}, email?: string) {
  const { slotMinutes } = slotsForDate(date.y, date.m, date.d, 0);
  const start = isoAt(date.y, date.m, date.d, hm.h, hm.min);
  const end = isoAt(date.y, date.m, date.d, hm.h, hm.min + slotMinutes);
  if (!email) return { needEmail:true, start, end, label: fmt(start) };
  try {
    const res = await fetch(`${SITE_BASE}${SCHEDULE_API_PATH}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ start, end, email }), cache: "no-store"
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "schedule failed");
    return { booked:true, start, end, meetLink:data?.meetLink, label: fmt(start) };
  } catch { return { error:true }; }
}

// ---------- LLM ----------
async function llmPlanReply(user: string, history: Msg[] | undefined) {
  if (!LLM_ENABLED) return null;
  const sys = `You are Replicant’s sales agent.
- Answer the question first (1–3 sentences), polite and clear.
- Offer to keep explaining or show times; do not push.
- Do not claim you booked or emailed.
Return STRICT JSON:
{"reply":"<text>","action":{"type":"none|pay|book|email","email":"<optional>"}}`;
  const messages = [
    { role:"system" as Role, content: sys },
    ...(history?.slice(-8)||[]),
    { role:"user" as Role, content: user },
  ];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{ "content-type":"application/json", authorization:`Bearer ${process.env.OPENAI_API_KEY!}` },
    body: JSON.stringify({ model: LLM_MODEL, temperature:0.4, max_tokens:220, messages }),
    cache:"no-store"
  });
  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;
  const m = raw.match(/\{[\s\S]*\}/);
  try { return JSON.parse(m ? m[0] : raw); } catch { return { reply: raw, action: { type:"none" as const } }; }
}

// ---------- route ----------
export async function POST(req: NextRequest) {
  const body = await req.json();
  const history: Msg[] | undefined = body.history;
  const filters = body.filters || {};
  const dateFilter = filters.date as { y:number, m:number, d:number } | undefined;
  const page = typeof filters.page === "number" ? filters.page : 0;

  // slot picked
  if ("pickSlot" in body && body.pickSlot?.start && body.pickSlot?.end) {
    const { start, end, email } = body.pickSlot;
    if (!email) return NextResponse.json({ type:"need_email", text:"What’s the best email for the calendar invite?" });
    try {
      const res = await fetch(`${SITE_BASE}${SCHEDULE_API_PATH}`, {
        method:"POST", headers:{ "content-type":"application/json" },
        body: JSON.stringify({ start, end, email }), cache:"no-store"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "schedule failed");
      return NextResponse.json({ type:"booked", text:`Booked — you’re on the calendar for ${fmt(start)} (ET). I’ve emailed the invite.`, meetLink:data?.meetLink, when: fmt(start) });
    } catch {
      return NextResponse.json({ type:"error", text:"Couldn’t book that slot. Mind trying another?" }, { status:500 });
    }
  }

  // email provided
  if ("provideEmail" in body && body.provideEmail?.email) {
    const email = body.provideEmail.email;
    if (dateFilter) {
      const { slots, total } = slotsForDate(dateFilter.y, dateFilter.m, dateFilter.d, page);
      if (!slots.length) {
        const nxt = nextWorkingDayWithSlots(dateFilter.y, dateFilter.m, dateFilter.d);
        if (nxt) {
          const { slots: s2 } = slotsForDate(nxt.y, nxt.m, nxt.d, 0);
          return NextResponse.json({ type:"slots", text:"No openings that day — here’s the next available (ET):", email, slots:s2, date:nxt, total:s2.length });
        }
      }
      return NextResponse.json({ type:"slots", text:"Great — pick a time that works (ET):", email, slots, date:dateFilter, total });
    }
    return NextResponse.json({ type:"text", text:`Thanks — I’ll use ${email}. When you say a day (e.g., Friday), I’ll show the available times (ET).`, email });
  }

  const message: string = body.message ?? "";
  const intent = detectIntent(message);

  // natural “day + time” → try booking
  if (intent === "book_exact") {
    const day = parseDay(message)!;
    const hm = parseTime(message)!;
    const email = latestEmail(history) || extractEmail(message);
    const res = await tryBookExact(day, hm, email || undefined);
    if ((res as any).booked) {
      const ok = res as any;
      return NextResponse.json({ type:"booked", text:`Booked — you’re on the calendar for ${ok.label} (ET). I’ve emailed the invite.`, meetLink: ok.meetLink, when: ok.label });
    }
    if ((res as any).needEmail) {
      const p = res as any;
      return NextResponse.json({ type:"need_email", text:`Perfect — I can book ${p.label} (ET). What’s the best email for the invite?`, start:p.start, end:p.end });
    }
    const { slots } = slotsForDate(day.y, day.m, day.d, 0);
    if (slots.length) return NextResponse.json({ type:"slots", text:"That exact time may not be open — here are the closest options (ET):", slots, date:day, total:slots.length });
    const nxt = nextWorkingDayWithSlots(day.y, day.m, day.d);
    if (nxt) {
      const { slots: s2 } = slotsForDate(nxt.y, nxt.m, nxt.d, 0);
      return NextResponse.json({ type:"slots", text:"No openings that day — next available (ET):", slots:s2, date:nxt, total:s2.length });
    }
    return NextResponse.json({ type:"text", text:"I couldn’t find an opening for that window. Want me to show a list of days (ET)?" });
  }

  if (intent === "pricing") {
    return NextResponse.json({ type:"text",
      text:"Yes — most clients launch at **$497 setup** + **$297/month**. That covers configuration, integrations, and ongoing tuning. We can keep chatting here, or I can show available times for a quick walkthrough (ET)."
    });
  }

  if (intent === "capability") {
    return NextResponse.json({ type:"text",
      text:"Yes — we can set up an agent that books appointments from WhatsApp or Instagram. It qualifies, proposes times, and confirms automatically. Prefer to keep chatting here or see times to talk live? (All times in Eastern Time.)"
    });
  }

  if (intent === "pay" && STRIPE_URL) {
    // Softer handoff + follow-up prompt
    return NextResponse.json({ type:"action", action:"open_url", url:STRIPE_URL,
      text:"You can complete checkout whenever you’re ready. Would you like me to walk you through it here, or show times for a quick Zoom?"
    });
  }

  if (intent === "book") {
    const day = parseDay(message) || dateFilter;
    if (day) {
      const { slots, total } = slotsForDate(day.y, day.m, day.d, page);
      if (!slots.length) {
        const nxt = nextWorkingDayWithSlots(day.y, day.m, day.d);
        if (nxt) {
          const { slots: s2 } = slotsForDate(nxt.y, nxt.m, nxt.d, 0);
          return NextResponse.json({ type:"slots", text:"No openings that day — here’s the next available (ET):", slots:s2, date:nxt, total:s2.length });
        }
      }
      return NextResponse.json({ type:"slots", text:"Pick a time that works (ET):", slots, date:day, total });
    }
    return NextResponse.json({ type:"ask_day", text:"Which day works for you? (Times are shown in Eastern Time.)" });
  }

  const planned = await llmPlanReply(message, history);
  if (!planned) {
    return NextResponse.json({ type:"text", text:"Happy to help. Ask me anything; when you mention a day I’ll show open times (ET)."});
  }
  const { reply, action } = planned;

  if (action?.type === "pay" && STRIPE_URL) {
    return NextResponse.json({ type:"action", action:"open_url", url:STRIPE_URL,
      text: reply || "You can complete checkout below when you’re ready. Want me to show times or keep explaining?" });
  }
  if (action?.type === "book") {
    return NextResponse.json({ type:"text", text: reply || "If you’d like, I can show available times (ET)." });
  }
  if (action?.type === "email") {
    const email = extractEmail(message) || action?.email || latestEmail(history);
    if (email) return NextResponse.json({ type:"text", text:`Thanks — I’ll use ${email}. Say a day (e.g., Friday) and I’ll show open times (ET).`, email });
  }

  return NextResponse.json({ type:"text", text: reply || "Got it — want me to keep explaining here, or show available times (ET)?" });
}
