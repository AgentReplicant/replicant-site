// lib/brain/index.ts
import { detectIntent } from "./intents";
import { copy, personas, PersonaId } from "./copy/en";
import { getSlots, bookSlot, getCheckoutLink } from "./actions";
import type { BrainCtx, BrainResult, Slot } from "./types";

/* ---------- Part-of-day windows (ET) ---------- */
const PART_OF_DAY_WINDOWS: Record<"morning"|"afternoon"|"evening", [number, number]> = {
  morning: [8 * 60, 11 * 60 + 59],
  afternoon: [12 * 60, 16 * 60 + 59],
  evening: [17 * 60, 20 * 60 + 59],
};

/* ---------- Helpers ---------- */
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

const personaList: PersonaId[] = ["alex", "riley", "jordan", "sora"];

function pickPersona(ctx: BrainCtx): PersonaId {
  // persona per conversation (sessionId should include a per-open seed from the widget)
  const s = (ctx.sessionId || "") + "|p2";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return personaList[Math.abs(h) % personaList.length];
}

function minutesFromLabel(slot: Slot): number | null {
  const m = slot.label.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  const mm = parseInt(m[2] || "0", 10);
  const ap = (m[3] || "").toLowerCase();
  if (ap === "pm" && hh < 12) hh += 12;
  if (ap === "am" && hh === 12) hh = 0;
  return hh * 60 + mm;
}
function filterByWindow(slots: Slot[], pod?: "morning" | "afternoon" | "evening") {
  if (!pod) return slots;
  const [lo, hi] = PART_OF_DAY_WINDOWS[pod];
  return slots.filter((s) => {
    const m = minutesFromLabel(s);
    return m != null && m >= lo && m <= hi;
  });
}
function ymdFromIso(iso: string) {
  const d = new Date(iso);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d2: d.getUTCDate() };
}
function sameYMD(a: {y:number;m:number;d2:number}, b:{y:number;m:number;d2:number}) {
  return a.y === b.y && a.m === b.m && a.d2 === b.d2;
}
function dayWordFromIso(iso: string, tz = "America/New_York") {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(iso));
}

function phraseForSlots(slots: Slot[]): string {
  if (!slots.length) return "I’m not seeing anything there.";
  // Group by day word and speak 2–3 times max
  const byDay = new Map<string, string[]>();
  for (const s of slots) {
    const day = s.label.split(" ")[0]; // "Thu"
    const time = s.label.replace(/^... /, "");
    const arr = byDay.get(day) || [];
    arr.push(time);
    byDay.set(day, arr);
  }
  const parts: string[] = [];
  for (const [day, times] of byDay) {
    const short = times.slice(0, 3); // cap to 3 per day
    if (short.length === 1) parts.push(`${day} ${short[0]}`);
    else if (short.length === 2) parts.push(`${day} ${short[0]} or ${short[1]}`);
    else parts.push(`${day} ${short[0]}, ${short[1]}, or ${short[2]}`);
  }
  if (parts.length === 1) return `I can do ${parts[0]} ET.`;
  const last = parts[parts.length - 1];
  return `I can do ${parts.slice(0, -1).join("; ")}, or ${last} ET.`;
}

/* ---------- Tone smoothing (optional) ---------- */
async function tone(text: string, ctx: BrainCtx, persona: PersonaId): Promise<string> {
  if (!process.env.LLM_ENABLED || process.env.LLM_ENABLED === "0" || !process.env.OPENAI_API_KEY) return text;
  try {
    const { default: OpenAI } = await import("openai");
    const client: any = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const system = [
      `You are ${persona.toUpperCase()} — ${personas[persona].style}.`,
      "Be casual-professional and concise. No menus, no repetition. Keep it to ~2 short sentences unless asked to expand.",
      "Offer phone by default; Google Meet only if they ask. Times are Eastern Time.",
      "Do not invent availability; rely only on provided content."
    ].join(" ");
    const resp = await client.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Rewrite this naturally in your style:\n---\n${text}\n---` },
      ],
    });
    return resp?.choices?.[0]?.message?.content?.trim() || text;
  } catch {
    return text;
  }
}

/* ---------- Brain ---------- */
export async function brainProcess(input: any, ctx: BrainCtx): Promise<BrainResult> {
  const persona = pickPersona(ctx);
  const intent = detectIntent(typeof input?.message === "string" ? input.message : "");
  const kind: string = (intent as any)?.kind;

  /* Final booking (client passes pickSlot) */
  if (input?.pickSlot) {
    const { start, end, email, mode, phone } = input.pickSlot || {};
    if (!start || !end || !email) return { type: "error", text: "I’ll need an email for the invite to confirm." };
    try {
      const r = await bookSlot({
        start, end, email,
        mode: mode === "video" ? "video" : "phone",
        phone: mode === "phone" ? (phone || "") : undefined,
        summary: "Replicant — Intro Call",
        description: mode === "phone"
          ? `Phone call. We will call: ${phone || "(number not provided)"}.`
          : "Auto-booked from chat. Times shown/scheduled in ET.",
      });
      const t = await tone("All set — calendar invite sent.", ctx, persona);
      return { type: "booked", when: r.when, meetLink: r.meetLink };
    } catch {
      return { type: "error", text: "Couldn’t book that time — want to try another?" };
    }
  }

  /* Checkout */
  if (kind === "pay") {
    try {
      const { url } = getCheckoutLink();
      const t = await tone("Here’s a secure checkout link for you:", ctx, persona);
      return { type: "action", action: "open_url", url, text: t };
    } catch {
      return { type: "error", text: "Checkout isn’t available yet." };
    }
  }

  /* Pricing */
  if (kind === "pricing") {
    const t = await tone(`${copy.pricingNudge} ${copy.valueCompare}`, ctx, persona);
    return { type: "text", text: t };
  }

  /* Human */
  if (kind === "human") {
    const t = await tone("Happy to help live. Want a quick phone call, or would you prefer Google Meet?", ctx, persona);
    return { type: "text", text: t };
  }

  /* Capabilities → keep it focused */
  if (kind === "capability") {
    // Short, targeted pitch. Expand only on request.
    const t = await tone(
      "We specialize in booking agents, customer support agents, and sales agents. If you’re after appointments and FAQs, our booking + support combo handles intake, availability, and answers in your voice.",
      ctx,
      persona
    );
    return { type: "text", text: t };
  }

  /* Booking logic */
  if (kind === "book" || kind === "day") {
    const pod = (intent as any)?.partOfDay as "morning" | "afternoon" | "evening" | undefined;

    // 1) If they haven’t given day or time-of-day yet → ask for it (with ET note)
    if (!ctx.date && !pod) {
      const t = await tone("What day works — or morning, afternoon, or evening? (Times are in Eastern Time.)", ctx, persona);
      return { type: "text", text: t };
    }

    // Helper: fetch a larger set when we need to search across days
    async function getLarge(date: any | null) {
      const { slots } = await getSlots(date ?? null, 0, 40);
      return (slots as Slot[]).filter((s) => !s.disabled);
    }

    try {
      // 2) If a day is set and they also implied a window (e.g., “Fri 10am” => morning),
      //    first try that day+window; if empty, propose: earliest window day vs first opening on that day.
      if (ctx.date && pod) {
        const dayEnabled = (await getLarge(ctx.date)) as Slot[];
        const dayWin = filterByWindow(dayEnabled, pod);

        if (dayWin.length > 0) {
          const phrase = phraseForSlots(dayWin.slice(0, 3));
          const t = await tone(`${phrase} What works for you?`, ctx, persona);
          return { type: "slots", text: t, date: ctx.date, slots: dayWin };
        }

        // No window on that day → find earliest window across next days
        const cross = await getLarge(null);
        const crossWin = filterByWindow(cross, pod);
        let earliestWin: Slot | undefined = crossWin[0];

        // Also find the first opening on the requested day (any window)
        const firstOnDay = dayEnabled[0];

        if (earliestWin && firstOnDay) {
          const nextDayWord = dayWordFromIso(earliestWin.start);
          const nextTimes = phraseForSlots([earliestWin]);
          const requestedDayWord = dayWordFromIso(firstOnDay.start); // same day
          const firstOnDayTime = firstOnDay.label.replace(/^... /, "");
          const line = `Next available ${pod} is ${nextDayWord.toLowerCase()} ${nextTimes.replace(/^I can do /, "").replace(/ ET\.$/, "")} ET. If you prefer ${requestedDayWord}, first opening is ${firstOnDayTime} ET.`;
          const t = await tone(`${line} What’s better?`, ctx, persona);
          const combined = [earliestWin, firstOnDay];
          return { type: "slots", text: t, date: ctx.date, slots: combined };
        }

        // If we only have a first opening on that day
        if (firstOnDay) {
          const requestedDayWord = dayWordFromIso(firstOnDay.start);
          const firstOnDayTime = firstOnDay.label.replace(/^... /, "");
          const t = await tone(`${requestedDayWord} morning is full. First opening that day is ${firstOnDayTime} ET. Want that, or should I check another morning?`, ctx, persona);
          return { type: "slots", text: t, date: ctx.date, slots: [firstOnDay] };
        }

        // If the day itself has no openings, fall back to asking
        const t = await tone("That day looks packed. Should I look at the next morning, or another day?", ctx, persona);
        return { type: "text", text: t };
      }

      // 3) If they gave only a window (morning/afternoon/evening), find earliest day(s) with that window
      if (!ctx.date && pod) {
        const enabled = await getLarge(null);
        const inWin = filterByWindow(enabled, pod);
        if (inWin.length === 0) {
          const t = await tone("That window looks full. Want me to check later that day or try another day?", ctx, persona);
          return { type: "text", text: t };
        }
        const phrase = phraseForSlots(inWin.slice(0, 3));
        const t = await tone(`${phrase} What works for you?`, ctx, persona);
        return { type: "slots", text: t, date: null, slots: inWin };
      }

      // 4) Day only: offer a few for that day (any window)
      if (ctx.date && !pod) {
        const enabled = await getLarge(ctx.date);
        if (enabled.length === 0) {
          const t = await tone("I’m not seeing openings that day. Want to try another day, or a time-of-day instead?", ctx, persona);
          return { type: "text", text: t };
        }
        const phrase = phraseForSlots(enabled.slice(0, 4));
        const t = await tone(`${phrase} What works for you?`, ctx, persona);
        return { type: "slots", text: t, date: ctx.date, slots: enabled };
      }

      // Fallback safety
      const t = await tone("What day works — or morning, afternoon, or evening? (Times are in Eastern Time.)", ctx, persona);
      return { type: "text", text: t };
    } catch {
      return { type: "error", text: "Couldn’t fetch times — mind trying again?" };
    }
  }

  /* First greet, then short discovery */
  if (!ctx.historyCount || ctx.historyCount < 1) {
    const p = personas[pickPersona(ctx)];
    const t = await tone(pick(p.greetFirstTime), ctx, persona);
    return { type: "text", text: t };
  }

  const t = await tone("Got it. What kind of business is this, and do you prefer a quick phone call or Google Meet?", ctx, persona);
  return { type: "text", text: t };
}
