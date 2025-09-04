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
  // day-of-week only (user asking for a specific day counts as book intent)
  if (detectDayOfWeek(m) !== null || /(today|tomorrow)/.test(m)) return "book";
  if (/more times|more options|show more/i.test(message)) return "book";
  return "unknown";
}

// Return weekday 0..6 (Sun..Sat), or null
function detectDayOfWeek(text: string): number | null {
  const m = text.toLowerCase();
  const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  for (let i = 0; i < days.length; i++) {
    if (m.includes(days[i]) || m.includes(days[i].slice(0,3))) return i;
  }
  if (m.includes("today")) {
    const n = new Date().toLocaleString("en-US",{ timeZone: BOOKING_TZ });
    return new Date(n).getDay(); // 0..6 in TZ
  }
  if (m.includes("tomorrow")) {
    const now = new Date();
    const n = new Date(now.getTime() + 86400000).toLocaleString("en-US",{ timeZone: BOOKING_TZ });
    return new Date(n).getDay();
  }
  return null;
}

// Generate slots; supports filters: dayOfWeek (0..6) and page (0,1,2...)
function nextSlots(targetCount = 5, opts?: { dayOfWeek?: number | null; page?: number }) {
  const { days = [1,2,3,4,5], startHour = 10, endHour = 16, slotMinutes = 30, minLeadHours = 2 } = parseRules();
  const now = new Date();
  const minLeadMs = minLeadHours * 3600_000;
  const page = Math.max(0, opts?.page ?? 0);
  const wantDOW = typeof opts?.dayOfWeek === "number" ? opts!.dayOfWeek! : null;

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

  const allowed = Array.isArray(days) && days.length ? days : [1,2,3,4,5]; // accept 0..6 or 1..7

  const out: { start: string; end: string; label: string }[] = [];
  const startOffset = page * 7; // each page = next 7 days
  for (let dayOffset = startOffset; dayOffset < startOffset + 14 && out.length < targetCount; dayOffset++) {
    const { y, m, d, weekdayNum } = toTZParts(now, dayOffset);
    const oneBased = ((weekdayNum + 6) % 7) + 1; // Mon=1..Sun=7
    const allowedByRules = allowed.includes(weekdayNum) || allowed.includes(oneBased);
    const allowedByFilter = (wantDOW === null) || (weekdayNum === wantDOW);
    if (!(allowedByRules && allowedByFilter)) continue;

    for (let H = startHour; H < endHour && out.length < targetCount; H++) {
      for (let M = 0; M < 60 && out.length < targetCount; M += slotMinutes) {
        const startISO = toTZISO(y, m, d, H, M);
        const endISO   = toTZISO(y, m, d, H, M + slotMinutes);
        if (new Date(startISO).getTime() - now.getTime() < minLeadMs) continue;

        const label = new Date(startISO).toLocaleString("en-US", {
          timeZone: BOOKING_TZ, weekday: "short", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit"
        });
        out.push({ start: startISO, end: endISO, label });
      }
    }
  }

  // Hard fallback: rolling hourly options starting 3h from now
  if (out.length === 0) {
    const seed = new Date(now.getTime() + Math.max(minLeadMs, 3 * 3600_000));
    for (let i = 0; i < targetCount; i++) {
      const s = new Date(seed.getTime() + i * 60 * 60 * 1000);
      const e = new Date(s.getTime() + (parseRules().slotMinutes || 30) * 60 * 1000);
      out.push({
        start: s.toISOString(),
        end: e.toISOString(),
        label: s.toLocaleString("en-US", {
          timeZone: BOOKING_TZ, weekday: "short", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit"
        }),
      });
    }
  }

  return out.slice(0, targetCount);
}

// ====== LLM (plan + reply) ======
async function llmPlanReply(user: string, history: Msg[] | undefined) {
  if (!LLM_ENABLED) return null;

  const sys =
`You are Replicant’s sales agent. Be concise (1–3 sentences), helpful, and confident.
Answer questions normally, handle objections, and offer to book or pay when appropriate.
Return STRICT JSON only:

{
  "reply": "<natural text>",
  "action": {"type": "none" | "pay" | "book" | "email", "email": "<optional>"}
}

Hard rules:
- Do NOT claim anything is booked or “I sent a confirmation”.
- If action is "book": do NOT state a specific time; invite them to pick a time below.
- If action is "pay": say a secure checkout is available below.
- Never fabricate links.`;

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
    body: JSON.stringify({ model: LLM_MODEL, temperature: 0.5, max_tokens: 220, messages }),
    cache: "no-store"
  });

  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;

  const match = raw.match(/\{[\s\S]*\}/);
  const text = match ? match[0] : raw;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.reply === "string" && parsed.action?.type) {
      return parsed as { reply: string; action: { type: "none" | "pay" | "book" | "email"; email?: string } };
    }
  } catch {}
  return { reply: raw, action: { type: "none" as const } };
}

// ====== ROUTE ======
export async function POST(req: NextRequest) {
  const body = await req.json();
  const history: Msg[] | undefined = body.history;

  // 0) Slot picked → real booking
  if ("pickSlot" in body && body.pickSlot?.start && body.pickSlot?.end) {
    const { start, end, email } = body.pickSlot;
    if (!email) {
      return NextResponse.json({ type: "need_email", text: "What’s the best email for the calendar invite?" });
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
        text: `Booked — you’re on the calendar for ${when}. I’ve emailed the invite.`,
        meetLink: data?.meetLink,
        when
      });
    } catch (e:any) {
      return NextResponse.json({ type: "error", text: `Couldn’t book that slot. Mind trying another?` }, { status: 500 });
    }
  }

  // 1) Email provided → show slots (keep last filters from client, if any)
  if ("provideEmail" in body && body.provideEmail?.email) {
    const email = body.provideEmail.email;
    const slots = nextSlots(5, { dayOfWeek: body.filters?.dayOfWeek ?? null, page: body.filters?.page ?? 0 });
    return NextResponse.json({ type: "slots", text: "Perfect — pick a time that works:", email, slots });
  }

  // 2) Normal chat
  const message: string = body.message ?? "";
  const intent = detectIntent(message);
  const dayFilter = detectDayOfWeek(message);
  const page = typeof body.filters?.page === "number" ? body.filters.page : 0;

  // INTENT-FIRST: pay/book/email → deterministic, no LLM uncertainty
  if (intent === "pay" && STRIPE_URL) {
    return NextResponse.json({ type: "action", action: "open_url", url: STRIPE_URL, text: "You can complete payment below." });
  }

  if (intent === "book") {
    const email = extractEmail(message) || undefined;
    const slots = nextSlots(5, { dayOfWeek: dayFilter, page });
    const note =
      dayFilter === null ? "Pick a time that works:" :
      `Here are times for ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dayFilter]}:`;
    return NextResponse.json({ type: "slots", text: email ? `Got it (${email}). ${note}` : note, email, slots });
  }

  if (intent === "email") {
    const email = extractEmail(message);
    if (email) {
      const slots = nextSlots(5, { dayOfWeek: dayFilter, page });
      const note =
        dayFilter === null ? `Perfect — I’ll use ${email}. Choose a time:` :
        `Perfect — I’ll use ${email}. Here are ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dayFilter]} times:`;
      return NextResponse.json({ type: "slots", text: note, email, slots });
    }
  }

  // LLM: handle open-ended Q&A; suggest next steps but don't force actions
  const planned = await llmPlanReply(message, history);
  if (!planned) {
    return NextResponse.json({ type: "text", text: "Happy to help. Ask me anything, or say “book a call” when you’re ready." });
  }
  const { reply, action } = planned;

  // We *offer* actions only if LLM suggests; otherwise just answer.
  if (action?.type === "pay" && STRIPE_URL) {
    return NextResponse.json({ type: "action", action: "open_url", url: STRIPE_URL, text: reply || "You can complete payment below." });
  }
  if (action?.type === "book") {
    const slots = nextSlots(5);
    return NextResponse.json({ type: "slots", text: reply || "Happy to lock a time — pick one below:", slots });
  }
  if (action?.type === "email") {
    const email = extractEmail(message) || action?.email;
    if (email) {
      const slots = nextSlots(5);
      return NextResponse.json({ type: "slots", text: `Perfect — I’ll use ${email}. Choose a time:`, email, slots });
    }
  }

  return NextResponse.json({ type: "text", text: reply || "Got it — when you’re ready, I can show times or share checkout." });
}
