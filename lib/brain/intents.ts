// lib/brain/intents.ts
import type { DateFilter } from "./types";

export type Intent =
  | { kind: "book" } // explicitly book/schedule a call or see times
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

// Phrases that clearly mean "schedule a call / see available times"
const BOOK_CALL = [
  /\b(book|schedule|grab|set|pick)\s+(a\s+)?(call|meeting|meet|time|slot)\b/i,
  /\b(see|show|share)\s+(your\s+)?(times|availability|openings|time\s*slots)\b/i,
  /\b(availability|times|time\s*slots)\s+(today|tomorrow|tmrw|mon|tue|wed|thu|fri|sat|sun)\b/i,
  /\b(talk|speak)\s+to\s+(a\s+)?(human|person|rep|agent)\b/i,
  /\bphone\s*call\b/i,
  /\bgoogle\s*meet\b/i,
];

export function detectIntent(text: string): Intent {
  const t = (text || "").trim();
  if (!t) return { kind: "fallback" };

  const low = t.toLowerCase();

  // direct actions
  if (/\b(checkout|pay( now)?|buy|sign ?up)\b/.test(low)) return { kind: "pay" };
  if (/\b(price|pricing|cost)\b/.test(low)) return { kind: "pricing" };
  if (/\b(talk to (a )?(human|person|rep|agent)|speak to (someone|a person))\b/.test(low))
    return { kind: "human" };

  // scheduling a call or asking for actual available times
  if (BOOK_CALL.some((re) => re.test(low))) return { kind: "book" };

  // Avoid false positives like "can your agent book appointments for my barbershop?"
  // If the text mentions appointments/bookings but NOT calls/times, keep it as fallback (product capability).
  if (/\b(appointment|appointments|booking|bookings)\b/.test(low)) return { kind: "fallback" };

  // day-only or day + part-of-day (used when they've already indicated they want times)
  if (DAY_WORD.test(low)) {
    return { kind: "day", word: low };
  }
  if (/(today|tomorrow|tmrw|mon|tue|wed|thu|fri|sat|sun)/i.test(low)) {
    let pod: "morning" | "afternoon" | "evening" | undefined;
    if (MORNING.test(low)) pod = "morning";
    else if (AFTERNOON.test(low)) pod = "afternoon";
    else if (EVENING.test(low)) pod = "evening";
    return { kind: "day", word: low, partOfDay: pod };
  }

  return { kind: "fallback" };
}

// (Reserved for later if you want server-side day parsing.)
export function toDateFilterFromWord(_word: string, _tz = "America/New_York"): DateFilter | null {
  return null;
}
