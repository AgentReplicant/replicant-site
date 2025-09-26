// lib/brain/index.ts
import { detectIntent } from "./intents";
import { copy, personas, PersonaId } from "./copy/en";
import { getSlots, bookSlot, getCheckoutLink } from "./actions";
import type { BrainCtx, BrainResult, Slot } from "./types";

// Morning/Afternoon/Evening windows (ET)
const PART_OF_DAY_WINDOWS: Record<string, [number, number]> = {
  morning: [8 * 60, 11 * 60 + 59],
  afternoon: [12 * 60, 16 * 60 + 59],
  evening: [17 * 60, 20 * 60 + 59],
};

function minutesOfDayFromLabel(slot: Slot): number | null {
  const m = slot.label.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  const mm = parseInt(m[2] || "0", 10);
  const ampm = (m[3] || "").toLowerCase();
  if (ampm === "pm" && hh < 12) hh += 12;
  if (ampm === "am" && hh === 12) hh = 0;
  return hh * 60 + mm;
}
function filterByPartOfDay(slots: Slot[], part?: "morning" | "afternoon" | "evening") {
  if (!part) return slots;
  const win = PART_OF_DAY_WINDOWS[part];
  return slots.filter((s) => {
    const m = minutesOfDayFromLabel(s);
    return m != null && m >= win[0] && m <= win[1];
  });
}

// ---- persona handling (stable per session) ----
function hashToIndex(s: string, mod: number) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}
function pickPersona(ctx: BrainCtx): PersonaId {
  const all: PersonaId[] = ["alex", "riley", "jordan", "sora"];
  const seed =
    ctx.sessionId ||
    ctx.lead?.email ||
    ctx.lead?.phone ||
    `${ctx.channel}:anon`;
  return all[hashToIndex(seed, all.length)];
}

async function tone(text: string, ctx: BrainCtx, persona: PersonaId): Promise<string> {
  if (!process.env.LLM_ENABLED || process.env.LLM_ENABLED === "0") return text;
  if (!process.env.OPENAI_API_KEY) return text;

  try {
    const { default: OpenAI } = await import("openai");
    const client: any = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const system = [
      `You are ${persona.toUpperCase()} — ${personas[persona].style}.`,
      "Be natural, concise, and human. Never sound robotic. No bullet lists or numbered choices.",
      "Offer phone or Google Meet for calls (Zoom not available).",
      "Times are Eastern Time by default.",
      "Do not fabricate availability; rely only on provided content.",
    ].join(" ");

    const prompt = `Rewrite the following reply in ${personas[persona].style} tone, keeping meaning intact:\n---\n${text}\n---`;

    const resp = await client.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    });

    const out = resp?.choices?.[0]?.message?.content?.trim();
    return out || text;
  } catch {
    return text;
  }
}

export async function brainProcess(input: any, ctx: BrainCtx): Promise<BrainResult> {
  const persona = pickPersona(ctx);

  // Structured booking action from client
  if (input?.pickSlot) {
    const { start, end, email } = input.pickSlot || {};
    if (!start || !end || !email) return { type: "error", text: "Missing details for booking." };

    try {
      const r = await bookSlot({
        start,
        end,
        email,
        summary: "Replicant intro call",
        description: "Booked via Replicant",
      });
      const text = await tone(copy.bookedOk(), ctx, persona);
      return { type: "booked", when: undefined, meetLink: r.meetLink };
    } catch {
      return { type: "error", text: "Couldn’t book that time — try another." };
    }
  }

  const message = typeof input?.message === "string" ? input.message : "";
  const intent = detectIntent(message);

  // Payment
  if (intent.kind === "pay") {
    try {
      const { url } = getCheckoutLink();
      const t = await tone(copy.linkIntro, ctx, persona);
      return { type: "action", action: "open_url", url, text: t };
    } catch {
      return { type: "error", text: "Checkout not available yet." };
    }
  }

  // Pricing
  if (intent.kind === "pricing") {
    const t = await tone(`${copy.pricingNudge} ${copy.valueCompare}`, ctx, persona);
    return { type: "text", text: t };
  }

  // Ask for human → offer call (phone/Meet)
  if (intent.kind === "human") {
    const t = await tone(copy.humanOffer, ctx, persona);
    if (ctx.date) {
      try {
        const { slots, date } = await getSlots(ctx.date, ctx.page ?? 0, 12);
        return { type: "slots", text: t, date, slots };
      } catch {
        return { type: "error", text: "Couldn’t fetch times — mind trying again?" };
      }
    }
    return { type: "text", text: `${t} ${copy.askDay}` };
  }

  // Booking / day (explicit scheduling)
  if (intent.kind === "book" || intent.kind === "day") {
    try {
      const { slots, date } = await getSlots(ctx.date ?? null, ctx.page ?? 0, 12);
      const filtered = intent.kind === "day" ? filterByPartOfDay(slots, intent.partOfDay) : slots;

      const anyEnabled = filtered.some((s) => !s.disabled);
      if (!anyEnabled) {
        const label = (() => {
          try {
            if (!ctx.date) return "that day";
            const d = new Date(ctx.date.y, ctx.date.m - 1, ctx.date.d);
            return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });
          } catch { return "that day"; }
        })();
        const t = await tone(copy.dayFull(label), ctx, persona);
        return { type: "text", text: t };
      }

      const t = await tone(copy.pickTime, ctx, persona);
      return { type: "slots", text: t, date, slots: filtered };
    } catch {
      return { type: "error", text: "Couldn’t fetch times — mind trying again?" };
    }
  }

  // Fallback
  // - First turn → persona greeting
  // - Later turns → helpful nudge (no re-greeting)
  if (!ctx.historyCount || ctx.historyCount === 0) {
    const p = personas[persona];
    const greet = p.greetFirstTime;
    const t = await tone(greet[Math.floor(Math.random() * greet.length)], ctx, persona);
    return { type: "text", text: t };
  }

  const t = await tone(copy.fallbackNudge, ctx, persona);
  return { type: "text", text: t };
}
