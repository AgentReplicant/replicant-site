// lib/brain/index.ts
import { detectIntent } from "./intents";
import { copy, personas, PersonaId } from "./copy/en";
import { getSlots, bookSlot, getCheckoutLink } from "./actions";
import type { BrainCtx, BrainResult, Slot, DateFilter } from "./types";

/** ---------- Part-of-day windows (ET) ---------- */
const PART_OF_DAY_WINDOWS: Record<"morning" | "afternoon" | "evening", [number, number]> = {
  morning: [8 * 60, 11 * 60 + 59],
  afternoon: [12 * 60, 16 * 60 + 59],
  evening: [17 * 60, 20 * 60 + 59],
};

/** ---------- Small helpers ---------- */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Deterministic persona per visitor (sessionId if present)
const personaList: PersonaId[] = ["alex", "riley", "jordan", "sora"];
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pickPersona(ctx: BrainCtx): PersonaId {
  const seed = ctx.sessionId || "anon";
  return personaList[hash(seed) % personaList.length];
}

function ymdFromDate(d: Date): { y: number; m: number; d: number } {
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

function dateFilterAddDays(df: DateFilter, days: number): DateFilter {
  const base =
    df && typeof df.y === "number" ? new Date(df.y, df.m - 1, df.d) : new Date();
  const next = new Date(base.getTime() + days * 86400000);
  return ymdFromDate(next);
}

// ACCEPT DateFilter (nullable). This fixes the TS error you saw.
function labelFromDateFilter(d?: DateFilter): string {
  if (!d) return "";
  try {
    return new Date(d.y, d.m - 1, d.d).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    });
  } catch {
    return "";
  }
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

function enabledSlots(slots: Slot[]): Slot[] {
  return (slots || []).filter((s) => !s.disabled);
}

function filterByPartOfDay(slots: Slot[], part?: "morning" | "afternoon" | "evening") {
  if (!part) return slots;
  const win = PART_OF_DAY_WINDOWS[part];
  return slots.filter((s) => {
    const m = minutesOfDayFromLabel(s);
    return m != null && m >= win[0] && m <= win[1];
  });
}

/**
 * Scan forward up to N days for the first date that has *enabled* slots.
 * If `part` is provided, prefer that window; fall back to any time if none found that day.
 */
async function scanForwardForAvailability(
  baseDate: DateFilter,
  part?: "morning" | "afternoon" | "evening",
  daysHorizon = 6
): Promise<{ date: DateFilter; slots: Slot[] }> {
  for (let i = 0; i <= daysHorizon; i++) {
    const df = dateFilterAddDays(baseDate, i);
    const { slots } = await getSlots(df, 0, 24);
    let filtered = slots;
    if (part) {
      filtered = filterByPartOfDay(slots, part);
      if (enabledSlots(filtered).length === 0) {
        // No matches in requested window; allow any time same day
        filtered = slots;
      }
    }
    const enabled = enabledSlots(filtered);
    if (enabled.length) return { date: df, slots: enabled };
  }
  // Nothing found in the horizon; return last checked day’s (possibly empty) set
  const fallback = dateFilterAddDays(baseDate, daysHorizon);
  return { date: fallback, slots: [] };
}

/** ---------- Optional LLM tone smoothing ---------- */
async function tone(text: string, ctx: BrainCtx, persona: PersonaId): Promise<string> {
  if (!process.env.LLM_ENABLED || process.env.LLM_ENABLED === "0") return text;
  if (!process.env.OPENAI_API_KEY) return text;
  try {
    const { default: OpenAI } = await import("openai");
    const client: any = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const system = [
      `You are ${persona.toUpperCase()} — ${personas[persona].style}.`,
      "Be natural, concise, and human. Never sound robotic. No bullet lists. No numbered choices.",
      "Offer phone or Google Meet for calls (Zoom not available). Times are Eastern Time by default.",
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

/** ---------- Brain ---------- */
export async function brainProcess(input: any, ctx: BrainCtx): Promise<BrainResult> {
  const persona = pickPersona(ctx);
  const intent = detectIntent(typeof input?.message === "string" ? input.message : "");

  // Structured booking (client-side picked a slot)
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
      const t = await tone(copy.bookedOk(), ctx, persona);
      return { type: "booked", when: undefined, meetLink: r.meetLink };
    } catch {
      return { type: "error", text: "Couldn’t book that time — try another." };
    }
  }

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

  // Human handoff → offer call
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
    return { type: "text", text: t + " " + copy.askDay };
  }

  // Capability / use-case questions (sales-first)
  if (intent.kind === "capability") {
    const parts = [
      copy.capabilityBooking,
      copy.capabilitySales,
      copy.capabilitySupport,
      copy.capabilityFollowup,
    ].join(" ");
    const t = await tone(parts, ctx, persona);
    return { type: "text", text: t };
  }

  // Booking or day-specific request
  if (intent.kind === "book" || intent.kind === "day") {
    try {
      const { slots, date } = await getSlots(ctx.date ?? null, ctx.page ?? 0, 12);
      const filtered = intent.kind === "day" ? filterByPartOfDay(slots, intent.partOfDay) : slots;
      const anyEnabled = enabledSlots(filtered).length > 0;

      if (!anyEnabled) {
        // That day (or part of day) is full — scan forward for the next available.
        const original = labelFromDateFilter(ctx.date || undefined) || "that day";
        const { date: nextDate, slots: nextSlots } = await scanForwardForAvailability(
          ctx.date ?? null,
          intent.kind === "day" ? intent.partOfDay : undefined
        );

        if (enabledSlots(nextSlots).length) {
          const msg = await tone(copy.dayFull(original), ctx, persona);
          return { type: "slots", text: msg, date: nextDate, slots: nextSlots };
        } else {
          // Nothing in horizon; fall back to gentle error
          return { type: "error", text: "Couldn’t fetch times — mind trying again?" };
        }
      }

      const t = await tone(copy.pickTime, ctx, persona);
      return { type: "slots", text: t, date, slots: filtered };
    } catch {
      return { type: "error", text: "Couldn’t fetch times — mind trying again?" };
    }
  }

  // Fallback: greet once, then discovery (sales-first)
  if (!ctx.historyCount || ctx.historyCount < 2) {
    const p = personas[persona];
    const t = await tone(pick(p.greetFirstTime), ctx, persona);
    return { type: "text", text: t };
  } else {
    const t = await tone(
      "Got it. Quick context: Replicant handles sales, booking, and support in one chat. What business are you running and which channels matter most — website, Instagram DMs, WhatsApp, or SMS?",
      ctx,
      persona
    );
    return { type: "text", text: t };
  }
}
