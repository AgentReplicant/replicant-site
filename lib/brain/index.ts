// lib/brain/index.ts
import { detectIntent } from "./intents";
import { copy, personas, PersonaId } from "./copy/en";
import { getSlots, bookSlot, getCheckoutLink } from "./actions";
import type { BrainCtx, BrainResult, Slot } from "./types";

/* ---------- Part-of-day windows (ET) ---------- */
const PART_OF_DAY_WINDOWS: Record<string, [number, number]> = {
  morning: [8 * 60, 11 * 60 + 59],
  afternoon: [12 * 60, 16 * 60 + 59],
  evening: [17 * 60, 20 * 60 + 59],
};

/* ---------- Small helpers ---------- */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const personaList: PersonaId[] = ["alex", "riley", "jordan", "sora"];

// Persona: derive from provided sessionId so each **conversation** can be randomized upstream
function pickPersona(ctx: BrainCtx): PersonaId {
  const s = (ctx.sessionId || "") + "|v2";
  // simple string hash
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % personaList.length;
  return personaList[idx];
}

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

function filterByPartOfDay(
  slots: Slot[],
  part?: "morning" | "afternoon" | "evening"
) {
  if (!part) return slots;
  const win = PART_OF_DAY_WINDOWS[part];
  return slots.filter((s) => {
    const m = minutesOfDayFromLabel(s);
    return m != null && m >= win[0] && m <= win[1];
  });
}

// Group slots by day label and phrase them conversationally
function phraseSlots(slots: Slot[]): string {
  if (!slots.length) return "I’m not seeing anything in that window.";
  // Group by weekday (first token of the label) → then times
  const byDay = new Map<string, string[]>();
  for (const s of slots) {
    const [dayWord, timePart] = s.label.split(" ");
    const time = s.label.replace(/^... /, ""); // drop "Mon"/"Tue"
    const k = dayWord || s.label.slice(0, 3);
    const arr = byDay.get(k) || [];
    arr.push(time);
    byDay.set(k, arr);
  }

  const parts: string[] = [];
  for (const [day, times] of byDay) {
    if (times.length === 1) {
      parts.push(`${day} ${times[0]}`);
    } else if (times.length === 2) {
      parts.push(`${day} ${times[0]} or ${times[1]}`);
    } else {
      const last = times[times.length - 1];
      parts.push(`${day} ${times.slice(0, -1).join(", ")}, or ${last}`);
    }
  }

  if (parts.length === 1) {
    return `I can do ${parts[0]} ET. What works for you?`;
  }
  const last = parts[parts.length - 1];
  return `I can do ${parts.slice(0, -1).join("; ")}, or ${last} ET. What works for you?`;
}

/* ---------- Tone smoothing (optional via LLM_ENABLED) ---------- */
async function tone(text: string, ctx: BrainCtx, persona: PersonaId): Promise<string> {
  if (!process.env.LLM_ENABLED || process.env.LLM_ENABLED === "0") return text;
  if (!process.env.OPENAI_API_KEY) return text;

  try {
    const { default: OpenAI } = await import("openai");
    const client: any = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const system = [
      `You are ${persona.toUpperCase()} — ${personas[persona].style}.`,
      "Be natural, concise, and human. No robotic menus. Don’t repeat the same sentence shape.",
      "Offer phone or Google Meet for calls (Zoom not available). Times are Eastern Time.",
      "Do not invent availability; rely only on provided content.",
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

/* ---------- Brain ---------- */
export async function brainProcess(input: any, ctx: BrainCtx): Promise<BrainResult> {
  const persona = pickPersona(ctx);
  const intent = detectIntent(typeof input?.message === "string" ? input.message : "");
  const kind: string = (intent as any)?.kind;

  /* Slot confirmation with contact (final booking) */
  if (input?.pickSlot) {
    const { start, end, email, mode, phone } = input.pickSlot || {};
    if (!start || !end || !email) return { type: "error", text: "I’ll need an email for the invite to confirm." };

    try {
      const r = await bookSlot({
        start,
        end,
        email,
        mode: mode === "video" ? "video" : "phone",
        phone: (mode === "phone" ? (phone || "") : undefined),
        summary: "Replicant — Intro Call",
        description:
          mode === "phone"
            ? `Phone call. We will call: ${phone || "(number not provided)"}.`
            : "Auto-booked from chat. Times shown/scheduled in ET.",
      });
      const text = await tone("All set! I’ve sent the calendar invite.", ctx, persona);
      return { type: "booked", when: r.when, meetLink: r.meetLink };
    } catch (e) {
      return { type: "error", text: "Couldn’t book that time — mind trying another?" };
    }
  }

  /* Payment */
  if (kind === "pay") {
    try {
      const { url } = getCheckoutLink();
      const t = await tone("Here’s a secure checkout link:", ctx, persona);
      return { type: "action", action: "open_url", url, text: t };
    } catch {
      return { type: "error", text: "Checkout isn’t available yet." };
    }
  }

  /* Pricing */
  if (kind === "pricing") {
    // Referral promo with dynamic expiry handled upstream in copy if needed.
    const t = await tone(`${copy.pricingNudge} ${copy.valueCompare}`, ctx, persona);
    return { type: "text", text: t };
  }

  /* Human request -> offer call */
  if (kind === "human") {
    const t = await tone("Happy to help live. Do you prefer a quick phone call or Google Meet?", ctx, persona);
    return { type: "text", text: t };
  }

  /* Capability / use-case questions (sales-first) */
  if (kind === "capability") {
    const parts = [
      copy.capabilityBooking,
      copy.capabilitySales,
      copy.capabilitySupport,
      copy.capabilityFollowup,
    ].join(" ");
    const t = await tone(parts, ctx, persona);
    return { type: "text", text: t };
  }

  /* Booking or time-of-day/day request */
  if (kind === "book" || kind === "day") {
    try {
      const { slots } = await getSlots(ctx.date ?? null, ctx.page ?? 0, 12);
      const filtered = kind === "day" ? filterByPartOfDay(slots, (intent as any).partOfDay) : slots;

      const enabled = filtered.filter((s) => !s.disabled);
      if (enabled.length === 0) {
        const t = await tone(
          "I’m not seeing openings in that window. Want me to look a bit later that day, or try another day (e.g., Friday)?",
          ctx,
          persona
        );
        return { type: "text", text: t };
      }

      const phrase = phraseSlots(enabled.slice(0, 6));
      const t = await tone(phrase, ctx, persona);
      // Still return the raw slots so the UI can match “6pm” naturally without chips
      return { type: "slots", text: `${t} (Times are in Eastern Time.)`, date: ctx.date ?? null, slots: enabled };
    } catch {
      return { type: "error", text: "Couldn’t fetch times — mind trying again?" };
    }
  }

  /* Greet or short discovery fallback */
  if (!ctx.historyCount || ctx.historyCount < 1) {
    const p = personas[persona];
    const greetOptions = p.greetFirstTime;
    const t = await tone(pick(greetOptions), ctx, persona);
    return { type: "text", text: t };
  }

  const t = await tone(
    "Gotcha. What kind of business is this, and would you prefer a quick phone call or Google Meet?",
    ctx,
    persona
  );
  return { type: "text", text: t };
}
