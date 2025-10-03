// lib/brain/intents.ts
import type { DateFilter } from "./types";

export type Intent =
  | { kind: "book" }
  | { kind: "day"; word: string; partOfDay?: "morning" | "afternoon" | "evening" }
  | { kind: "pricing" }
  | { kind: "pay" }
  | { kind: "human" }
  | { kind: "capability" }
  | { kind: "fallback" };

const DAY_WORD =
  /(?:\b|^)(today|tmrw|tomorrow|sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)(?:\b|$)/i;

const MORNING = /\bmorning\b/i;
const AFTERNOON = /\bafternoon\b/i;
const EVENING = /\bevening|night\b/i;

// Loose time phrases like "10am", "around 6", "6:30 pm"
const CLOCK_RE = /(around|about|after|before|by)?\s*\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

// Expanded human intent (single-word preferences included)
const HUMAN_RE =
  /\b(talk to (a )?(human|person|rep|agent)|speak to (someone|a person)|human support)\b/i;
const HUMAN_SHORT_RE =
  /^(?:phone|call|phone call|google ?meet|meet|video call|video)$/i;

function clockToPartOfDay(text: string): "morning" | "afternoon" | "evening" | undefined {
  const m = text.toLowerCase().match(CLOCK_RE);
  if (!m) return undefined;
  let hh = parseInt(m[2], 10);
  const mm = parseInt(m[3] || "0", 10); // eslint-disable-line @typescript-eslint/no-unused-vars
  const ap = (m[4] || "") as "am" | "pm" | "";

  if (ap === "am") return "morning";
  if (ap === "pm") {
    if (hh >= 5 && hh <= 8) return "evening"; // 5–8pm
    return "afternoon"; // noon–4pm and beyond
  }
  if (hh === 12) return "afternoon";
  if (hh >= 1 && hh <= 7) return "evening";
  if (hh >= 8 && hh <= 11) return "morning";
  return undefined;
}

export function detectIntent(text: string): Intent {
  const t = (text || "").trim();
  if (!t) return { kind: "fallback" };
  const low = t.toLowerCase();

  // Money & checkout
  if (/\b(checkout|pay( now)?|buy|sign ?up)\b/.test(low)) return { kind: "pay" };
  if (/\b(price|pricing|cost)\b/.test(low)) return { kind: "pricing" };

  // Human handoff / preference
  if (HUMAN_RE.test(low) || HUMAN_SHORT_RE.test(low)) return { kind: "human" };

  // Scheduling / availability
  if (
    /\b(book|schedule|set up|hop on)\b.*\b(call|meeting|meet|phone)\b/.test(low) ||
    /\b(available|availability|times?|time slots?|slots?)\b/.test(low)
  ) {
    return { kind: "book" };
  }

  // Day + part-of-day via words or clock time
  const dayHit = low.match(DAY_WORD);
  const byWords =
    MORNING.test(low) ? "morning" :
    AFTERNOON.test(low) ? "afternoon" :
    EVENING.test(low) ? "evening" : undefined;

  const byClock = clockToPartOfDay(low);

  if (dayHit) {
    const pod = byWords || byClock;
    return { kind: "day", word: dayHit[1], partOfDay: pod };
  }

  // Part-of-day alone → cross-day search
  if (byWords) return { kind: "day", word: "part-of-day", partOfDay: byWords as any };

  // Pure clock time implies booking intent; day will be chosen later
  if (CLOCK_RE.test(low)) return { kind: "book" };

  // Capability / use-case / integrations
  if (
    /\b(can it|is it possible|does it|do you|support|handle|integrate|work with)\b/.test(low) ||
    /\b(appointments?|booking|sales|support|instagram|whatsapp|sms|dms?)\b/.test(low)
  ) {
    return { kind: "capability" };
  }

  return { kind: "fallback" };
}

// Reserved for later server-side day resolution.
export function toDateFilterFromWord(_word: string, _tz = "America/New_York"): DateFilter | null {
  return null;
}
