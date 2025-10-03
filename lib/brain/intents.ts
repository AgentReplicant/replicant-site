// lib/brain/intents.ts
import type { DateFilter } from "./types";

export type Intent =
  | { kind: "book" }
  | {
      kind: "day";
      word: string;
      partOfDay?: "morning" | "afternoon" | "evening";
    }
  | { kind: "pricing" }
  | { kind: "pay" }
  | { kind: "human" }
  | { kind: "capability" }
  | { kind: "fallback" };

const DAY_WORD =
  /^(?:today|tmrw|tomorrow|sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)$/i;

const MORNING = /\bmorning|early\s*day\b/i;
const AFTERNOON = /\bafternoon|early\s*evening|after\s*noon\b/i;
const EVENING = /\bevening|night|late\b/i;

// Loose time phrases like "around six", "after 5", "about 6:30"
const LOOSE_TIME = /(around|about|after|before|by)?\s*\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

export function detectIntent(text: string): Intent {
  const t = (text || "").trim();
  if (!t) return { kind: "fallback" };
  const low = t.toLowerCase();

  // Money & checkout
  if (/\b(checkout|pay( now)?|buy|sign ?up)\b/.test(low)) return { kind: "pay" };
  if (/\b(price|pricing|cost)\b/.test(low)) return { kind: "pricing" };

  // Human handoff
  if (
    /\b(talk to (a )?(human|person|rep|agent)|speak to (someone|a person))\b/.test(
      low
    )
  )
    return { kind: "human" };

  // Real scheduling intent (call/meeting/availability)
  if (
    /\b(book|schedule|set up|hop on)\b.*\b(call|meeting|meet|phone)\b/.test(low) ||
    /\b(available|availability|times?|time slots?|slots?)\b/.test(low)
  ) {
    return { kind: "book" };
  }

  // Exact day words
  if (DAY_WORD.test(low)) return { kind: "day", word: low };

  // Day + part-of-day (“friday morning”, “tmrw evening”)
  if (/(today|tomorrow|tmrw|mon|tue|wed|thu|fri|sat|sun)/i.test(low)) {
    let pod: "morning" | "afternoon" | "evening" | undefined;
    if (MORNING.test(low)) pod = "morning";
    else if (AFTERNOON.test(low)) pod = "afternoon";
    else if (EVENING.test(low)) pod = "evening";
    return { kind: "day", word: low, partOfDay: pod };
  }

  // Part-of-day alone (“morning / afternoon / evening”) → cross-day search
  if (MORNING.test(low)) return { kind: "day", word: "part-of-day", partOfDay: "morning" };
  if (AFTERNOON.test(low)) return { kind: "day", word: "part-of-day", partOfDay: "afternoon" };
  if (EVENING.test(low)) return { kind: "day", word: "part-of-day", partOfDay: "evening" };

  // Loose time phrases imply booking intent (“around six”, “after 5”, “6:30”)
  if (LOOSE_TIME.test(low)) return { kind: "book" };

  // Capability / use-case / integrations
  if (
    /\b(can it|is it possible|does it|do you|support|handle|integrate|work with)\b/.test(
      low
    ) ||
    /\b(appointments?|booking|sales|support|instagram|whatsapp|sms|dms?)\b/.test(low)
  ) {
    return { kind: "capability" };
  }

  return { kind: "fallback" };
}

export function toDateFilterFromWord(_word: string, _tz = "America/New_York"): DateFilter | null {
  return null;
}
