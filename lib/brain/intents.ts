// lib/brain/intents.ts
import type { DateFilter } from "./types";

export type Intent =
  | { kind: "book" }
  | { kind: "day"; word: string; partOfDay?: "morning" | "afternoon" | "evening" }
  | { kind: "pricing" }
  | { kind: "pay" }
  | { kind: "human" }
  | { kind: "fallback" };

const DAY_WORD =
  /^(?:today|tmrw|tomorrow|sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)$/i;

const MORNING = /\bmorning\b/i;
const AFTERNOON = /\bafternoon\b/i;
const EVENING = /\bevening|night\b/i;

export function detectIntent(text: string): Intent {
  const t = (text || "").trim();

  if (!t) return { kind: "fallback" };

  const low = t.toLowerCase();

  if (/\b(checkout|pay( now)?|buy|sign ?up)\b/.test(low)) return { kind: "pay" };
  if (/\b(price|pricing|cost)\b/.test(low)) return { kind: "pricing" };
  if (/\b(talk to (a )?(human|person|rep|agent)|speak to (someone|a person))\b/.test(low))
    return { kind: "human" };
  if (/\b(book|schedule|meeting|meet|call|phone)\b/.test(low)) return { kind: "book" };

  if (DAY_WORD.test(low)) {
    return { kind: "day", word: low };
  }

  // day + part of day in one sentence e.g., "friday morning", "tomorrow afternoon"
  if (/(today|tomorrow|tmrw|mon|tue|wed|thu|fri|sat|sun)/i.test(low)) {
    let pod: "morning" | "afternoon" | "evening" | undefined;
    if (MORNING.test(low)) pod = "morning";
    else if (AFTERNOON.test(low)) pod = "afternoon";
    else if (EVENING.test(low)) pod = "evening";
    return { kind: "day", word: low, partOfDay: pod };
  }

  return { kind: "fallback" };
}

// Let the web client do exact day resolution; other channels can
// set ctx.date directly in their adapter. This helper is here if we want later.
export function toDateFilterFromWord(_word: string, _tz = "America/New_York"): DateFilter | null {
  return null;
}
