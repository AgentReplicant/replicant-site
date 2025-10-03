// lib/brain/index.ts
import { detectIntent } from "./intents";
import { copy, personas, PersonaId } from "./copy/en";
import { getSlots, bookSlot, getCheckoutLink } from "./actions";
import type { BrainCtx, BrainResult, Slot } from "./types";

/* ---------- Part-of-day windows (ET) ---------- */
const POD: Record<"morning"|"afternoon"|"evening", [number, number]> = {
  morning: [8 * 60, 11 * 60 + 59],
  afternoon: [12 * 60, 16 * 60 + 59],
  evening: [17 * 60, 20 * 60 + 59],
};

/* ---------- Helpers ---------- */
const personasList: PersonaId[] = ["alex", "riley", "jordan", "sora"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function pickPersona(ctx: BrainCtx): PersonaId {
  const s = (ctx.sessionId || "") + "|p3";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return personasList[Math.abs(h) % personasList.length];
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
  if (!slots.length) return "I’m not seeing anything there.";
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
    const short = times.slice(0, capPerDay);
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
      "Casual-professional and concise. 1–2 short sentences unless asked to expand.",
      "Default to phone; use Google Meet only if the user asks. Times are Eastern Time.",
      "Never invent availability; rely on provided slot data.",
    ].join(" ");
    const resp = await client.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Rewrite naturally in your style:\n---\n${text}\n---` },
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

  /* Checkout / Pricing */
  if (kind === "pay") {
    try {
      const { url } = getCheckoutLink();
      const t = await tone("Here’s a secure checkout link for you:", ctx, persona);
      return { type: "action", action: "open_url", url, text: t };
    } catch {
      return { type: "error", text: "Checkout isn’t available yet." };
    }
  }
  if (kind === "pricing") {
    const t = await tone(`${copy.pricingNudge} ${copy.valueCompare}`, ctx, persona);
    return { type: "text", text: t };
  }

  /* Human intent → go straight to scheduling ask (no loop) */
  if (kind === "human") {
    const t = await tone("Great—let’s set it up. What day works, or do you prefer morning, afternoon, or evening? (ET.)", ctx, persona);
    return { type: "text", text: t };
  }

  /* Capabilities — short & non-repetitive */
  if (kind === "capability") {
    const early = (ctx.historyCount || 0) < 6; // rough dedupe: first time early in convo
    const text = early
      ? "We specialize in booking agents, customer support agents, and sales agents. For appointments + FAQs, our booking + support combo handles intake, live availability, and answers in your voice—you can edit the wording anytime."
      : "Yep—our booking + support agents handle that. Want me to help you set it up?";
    const t = await tone(text, ctx, persona);
    return { type: "text", text: t };
  }

  /* Booking logic */
  if (kind === "book" || kind === "day") {
    const pod = (intent as any)?.partOfDay as "morning" | "afternoon" | "evening" | undefined;

    // Ask for day or window first (ET note shown here)
    if (!ctx.date && !pod) {
      const t = await tone("What day works for you, or morning/afternoon/evening? (Times are in Eastern Time.)", ctx, persona);
      return { type: "text", text: t };
    }

    async function getEnabled(date: any | null, limit = 40) {
      const { slots } = await getSlots(date ?? null, 0, limit);
      return (slots as Slot[]).filter((s) => !s.disabled);
    }

    try {
      // If day + window (e.g., “Fri 10am/morning”) → try that day/window first
      if (ctx.date && pod) {
        const dayEnabled = await getEnabled(ctx.date);
        const dayWin = filterByPod(dayEnabled, pod);

        if (dayWin.length > 0) {
          const phrase = phraseForSlots(dayWin.slice(0, 3));
          const t = await tone(`${phrase} What works for you?`, ctx, persona);
          return { type: "slots", text: t, date: ctx.date, slots: dayWin };
        }

        // No morning on that day → propose: next morning vs first opening on that day
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
          const t = await tone(`${line} What’s better?`, ctx, persona);
          return { type: "slots", text: t, date: ctx.date, slots: [earliestWin, firstOnDay] };
        }

        if (firstOnDay) {
          const reqDay = dayWord(firstOnDay.start);
          const reqTime = firstOnDay.label.replace(/^... /, "");
          const t = await tone(`${reqDay} ${pod} is full. First opening that day is ${reqTime} ET. Want that, or should I check another ${pod}?`, ctx, persona);
          return { type: "slots", text: t, date: ctx.date, slots: [firstOnDay] };
        }

        const t = await tone("That day looks packed. Should I try the next morning, or another day?", ctx, persona);
        return { type: "text", text: t };
      }

      // Window only → earliest days with that window
      if (!ctx.date && pod) {
        const enabled = await getEnabled(null);
        const inWin = filterByPod(enabled, pod);
        if (inWin.length === 0) {
          const t = await tone("That window looks full. Want me to check later that day or try another day?", ctx, persona);
          return { type: "text", text: t };
        }
        const phrase = phraseForSlots(inWin.slice(0, 3));
        const t = await tone(`${phrase} What works for you?`, ctx, persona);
        return { type: "slots", text: t, date: null, slots: inWin };
      }

      // Day only → show a few options on that day
      if (ctx.date && !pod) {
        const enabled = await getEnabled(ctx.date);
        if (enabled.length === 0) {
          const t = await tone("I’m not seeing openings that day. Try another day, or give me a time-of-day?", ctx, persona);
          return { type: "text", text: t };
        }
        const phrase = phraseForSlots(enabled.slice(0, 4));
        const t = await tone(`${phrase} What works for you?`, ctx, persona);
        return { type: "slots", text: t, date: ctx.date, slots: enabled };
      }

      // Safety
      const t = await tone("What day works for you, or morning/afternoon/evening? (ET.)", ctx, persona);
      return { type: "text", text: t };
    } catch {
      return { type: "error", text: "Couldn’t fetch times — mind trying again?" };
    }
  }

  /* Greet + directional fallback */
  if (!ctx.historyCount || ctx.historyCount < 1) {
    const p = personas[pickPersona(ctx)];
    const t = await tone(pick(p.greetFirstTime), ctx, persona);
    return { type: "text", text: t };
  }

  const t = await tone(
    "Got it. To set up a quick call, what day works—or morning, afternoon, or evening? (ET.)",
    ctx,
    persona
  );
  return { type: "text", text: t };
}
