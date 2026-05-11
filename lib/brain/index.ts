// lib/brain/index.ts
import { detectIntent } from "./intents";
import { copy } from "./copy/en";
import { getSlots, bookSlot } from "./actions";
import type { BrainCtx, BrainResult, Slot } from "./types";

/* ---------- Part-of-day windows (ET) ---------- */
const POD: Record<"morning" | "afternoon" | "evening", [number, number]> = {
  morning: [8 * 60, 11 * 60 + 59],
  afternoon: [12 * 60, 16 * 60 + 59],
  evening: [17 * 60, 20 * 60 + 59],
};

/* ---------- Helpers ---------- */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function minsFromLabel(slot: Slot): number | null {
  const m = slot.label.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  const mm = parseInt(m[2] || "0", 10);
  const ap = (m[3] || "").toLowerCase();
  if (ap === "pm" && hh < 12) hh += 12;
  if (ap === "am" && hh === 12) hh = 0;
  return hh * 60 + mm;
}

function filterByPod(slots: Slot[], pod?: "morning" | "afternoon" | "evening") {
  if (!pod) return slots;
  const [lo, hi] = POD[pod];
  return slots.filter((s) => {
    const m = minsFromLabel(s);
    return m != null && m >= lo && m <= hi;
  });
}

function dayWord(iso: string, tz = "America/New_York") {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(iso));
}

function phraseForSlots(slots: Slot[], capPerDay = 3): string {
  if (!slots.length) return "I'm not seeing anything there.";
  const byDay = new Map<string, string[]>();
  for (const s of slots) {
    const atIdx = s.label.indexOf(" at ");
    const day = atIdx !== -1 ? s.label.slice(0, atIdx) : s.label.split(" ")[0];
    const time = atIdx !== -1 ? s.label.slice(atIdx + 4) : s.label;
    const arr = byDay.get(day) || [];
    arr.push(time);
    byDay.set(day, arr);
  }
  const parts: string[] = [];
  for (const [day, times] of byDay) {
    const short = times.slice(0, capPerDay);
    if (short.length === 1) parts.push(`${day} at ${short[0]}`);
    else if (short.length === 2) parts.push(`${day} at ${short[0]} or ${short[1]}`);
    else parts.push(`${day} at ${short[0]}, ${short[1]}, or ${short[2]}`);
  }
  if (parts.length === 1) return `I can do ${parts[0]}.`;
  const last = parts[parts.length - 1];
  return `I can do ${parts.slice(0, -1).join("; ")}, or ${last}.`;
}

/* ---------- Optional tone smoothing ---------- */
async function tone(text: string, _ctx: BrainCtx): Promise<string> {
  if (!process.env.LLM_ENABLED || process.env.LLM_ENABLED === "0" || !process.env.OPENAI_API_KEY) return text;
  try {
    const { default: OpenAI } = await import("openai");
    const client: any = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const system = [
      "You are the official Replicant site assistant.",
      "Replicant builds professional websites for service businesses (beauty, wellness, home & trade).",
      "Replicant assistants are an upcoming optional upgrade for those websites.",
      "Tone: clear, professional, consultative, helpful. Not pushy, not over-chatty.",
      "1–2 short sentences unless asked to expand.",
      "Never describe websites as 'AI-built' or 'AI-generated.' Websites are professional. AI/assistants are an optional upgrade.",
      "Calls are an escalation path, not the default. Don't push scheduling unless the user asks.",
    ].join(" ");
    const resp = await client.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Rewrite naturally in the Replicant assistant voice:\n---\n${text}\n---` },
      ],
    });
    return resp?.choices?.[0]?.message?.content?.trim() || text;
  } catch {
    return text;
  }
}

function norm(s?: string) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").replace(/[.,!?;:()\[\]'"]/g, "").trim();
}

async function say(text: string, ctx: BrainCtx): Promise<string> {
  const t = await tone(text, ctx);
  // If we'd repeat ourselves verbatim, fall back to soft alternative
  if (norm(t) === norm(ctx.lastAssistant)) {
    return await tone(copy.softFallback, ctx);
  }
  return t;
}

/* ---------- Email validation for handoff ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/* ---------- Brain ---------- */
export async function brainProcess(input: any, ctx: BrainCtx): Promise<BrainResult> {
  const intent = detectIntent(typeof input?.message === "string" ? input.message : "");
  const kind: string = (intent as any)?.kind;

  /* ---------- Final booking (client passes pickSlot) — preserved ---------- */
  if (input?.pickSlot) {
    const { start, end, email, mode, phone } = input.pickSlot || {};
    if (!start || !end || !email)
      return { type: "error", text: "I'll need an email for the invite to confirm." };
    try {
      const r = await bookSlot({
        start, end, email,
        mode: mode === "video" ? "video" : "phone",
        phone: mode === "phone" ? (phone || "") : undefined,
        summary: "Replicant — Intro Call",
        description: mode === "phone"
          ? `Phone call. We will call: ${phone || "(number not provided)"}.`
          : "Auto-booked from Replicant site chat. Times in ET.",
      });
      return { type: "booked", when: r.when, meetLink: r.meetLink };
    } catch {
      return { type: "error", text: "Couldn't book that time — want to try another?" };
    }
  }

  /* ---------- "What is Replicant?" ---------- */
  if (kind === "what_is") {
    const t = await say(`${copy.whatIsReplicant} ${copy.routeToAudit}`, ctx);
    return { type: "text", text: t };
  }

  /* ---------- Categories ---------- */
  if (kind === "category") {
    const cat = (intent as any).category as "beauty" | "wellness" | "home_trade" | "overview";
    let text: string;
    if (cat === "beauty") text = `${copy.categoryBeauty} ${copy.routeToAudit}`;
    else if (cat === "wellness") text = `${copy.categoryWellness} ${copy.routeToAudit}`;
    else if (cat === "home_trade") text = `${copy.categoryHomeTrade} ${copy.routeToAudit}`;
    else text = `${copy.categoriesOverview} Which one fits your business?`;
    const t = await say(text, ctx);
    return { type: "text", text: t };
  }

  /* ---------- Pricing ---------- */
  if (kind === "pricing") {
    const tier = (intent as any).tier as "starter" | "booking" | "assistant" | "overview" | undefined;
    let text: string;
    if (tier === "starter") text = `${copy.pricingStarter} ${copy.routeToAudit}`;
    else if (tier === "booking") text = `${copy.pricingBookingQuote} ${copy.routeToAudit}`;
    else if (tier === "assistant") text = `${copy.pricingSiteAssistant} ${copy.routeToGetStarted}`;
    else text = `${copy.pricingOverview} ${copy.routeToAudit}`;
    const t = await say(text, ctx);
    return { type: "text", text: t };
  }

  /* ---------- Audit intent ---------- */
  if (kind === "audit") {
    const text = `${copy.auditPitch} ${copy.auditLink}`;
    const t = await say(text, ctx);
    return { type: "text", text: t };
  }

  /* ---------- Assistant upgrade interest ---------- */
  if (kind === "assistant_info") {
    const t = await say(`${copy.assistantStatus}`, ctx);
    return { type: "text", text: t };
  }

  /* ---------- Human mode reply — phone / video / email ---------- */
  if (kind === "human_mode") {
    const chosenMode = (intent as any).mode as "phone" | "video" | "email";
    if (chosenMode === "email") {
      const t = await say(copy.emailHandoff, ctx);
      return { type: "text", text: t };
    }
    if (chosenMode === "phone") {
      const t = await say("Phone works. What day works for you — or morning, afternoon, or evening? (ET.)", ctx);
      return { type: "text", text: t };
    }
    // video
    const t = await say("Google Meet it is. What day works for you — or morning, afternoon, or evening? (ET.)", ctx);
    return { type: "text", text: t };
  }

  /* ---------- Human intent → offer phone / Meet / email ---------- */
  if (kind === "human") {
    const t = await say(copy.humanOffer, ctx);
    return { type: "text", text: t };
  }

  /* ---------- Pay (Stripe checkout) — kept but deprioritized ---------- */
  if (kind === "pay") {
    // Old Stripe link is for the AI assistant product, which is now in development.
    // Route to /get-started for interest registration instead.
    const t = await say(`${copy.assistantStatus}`, ctx);
    return { type: "text", text: t };
  }

  /* ---------- Booking logic — preserved, only triggered when user explicitly asks ---------- */
  if (kind === "book" || kind === "day") {
    const pod = (intent as any)?.partOfDay as "morning" | "afternoon" | "evening" | undefined;

    if (!ctx.date && !pod) {
      const t = await say("What day works for you — or morning, afternoon, or evening? (ET.)", ctx);
      return { type: "text", text: t };
    }

    async function getEnabled(date: any | null, limit = 40) {
      const { slots } = await getSlots(date ?? null, 0, limit);
      return (slots as Slot[]).filter((s) => !s.disabled);
    }

    try {
      if (ctx.date && pod) {
        const dayEnabled = await getEnabled(ctx.date);
        const dayWin = filterByPod(dayEnabled, pod);
        if (dayWin.length > 0) {
          const phrase = phraseForSlots(dayWin.slice(0, 3));
          const t = await say(`${phrase} What works for you?`, ctx);
          return { type: "slots", text: t, date: ctx.date, slots: dayWin };
        }
        const cross = await getEnabled(null);
        const crossWin = filterByPod(cross, pod);
        const earliestWin = crossWin[0];
        const firstOnDay = dayEnabled[0];
        if (earliestWin && firstOnDay) {
          const nextDayWord = dayWord(earliestWin.start).toLowerCase();
          const nextTime = earliestWin.label.replace(/^... /, "");
          const reqDay = dayWord(firstOnDay.start);
          const reqTime = firstOnDay.label.replace(/^... /, "");
          const line = `Next available ${pod} is ${nextDayWord} at ${nextTime} ET. If you prefer ${reqDay}, first opening is ${reqTime} ET.`;
          const t = await say(`${line} What's better?`, ctx);
          return { type: "slots", text: t, date: ctx.date, slots: [earliestWin, firstOnDay] };
        }
        if (firstOnDay) {
          const reqDay = dayWord(firstOnDay.start);
          const reqTime = firstOnDay.label.replace(/^... /, "");
          const t = await say(
            `${reqDay} ${pod} is full. First opening that day is ${reqTime} ET. Want that, or should I check another ${pod}?`,
            ctx
          );
          return { type: "slots", text: t, date: ctx.date, slots: [firstOnDay] };
        }
        const t = await say("That day looks packed. Should I try the next morning, or another day?", ctx);
        return { type: "text", text: t };
      }

      if (!ctx.date && pod) {
        const enabled = await getEnabled(null);
        const inWin = filterByPod(enabled, pod);
        if (inWin.length === 0) {
          const t = await say("That window looks full. Want me to check later that day or try another day?", ctx);
          return { type: "text", text: t };
        }
        const phrase = phraseForSlots(inWin.slice(0, 3));
        const t = await say(`${phrase} What works for you?`, ctx);
        return { type: "slots", text: t, date: null, slots: inWin };
      }

      if (ctx.date && !pod) {
        const enabled = await getEnabled(ctx.date);
        if (enabled.length === 0) {
          const t = await say("I'm not seeing openings that day. Try another day, or give me a time-of-day?", ctx);
          return { type: "text", text: t };
        }
        const phrase = phraseForSlots(enabled.slice(0, 4));
        const t = await say(`${phrase} What works for you?`, ctx);
        return { type: "slots", text: t, date: ctx.date, slots: enabled };
      }

      const t = await say("What day works for you — or morning, afternoon, or evening? (ET.)", ctx);
      return { type: "text", text: t };
    } catch {
      return { type: "error", text: "Couldn't fetch times — mind trying again?" };
    }
  }

  /* ---------- Greet on first turn ---------- */
  if (!ctx.historyCount || ctx.historyCount < 1) {
    const t = await say(pick(copy.greetFirstTime), ctx);
    return { type: "text", text: t };
  }

  /* ---------- Generic capability question — answer with website-first explanation ---------- */
  if (kind === "capability") {
    const text = `${copy.whatIsReplicant} ${copy.categoriesOverview} ${copy.routeToAudit}`;
    const t = await say(text, ctx);
    return { type: "text", text: t };
  }

  /* ---------- Soft fallback — never call-pushy ---------- */
  const t = await say(copy.softFallback, ctx);
  return { type: "text", text: t };
}