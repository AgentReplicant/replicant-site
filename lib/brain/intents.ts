// lib/brain/intents.ts

import type { QualificationField } from "@/lib/shared/types";

export type Intent =
  | { kind: "book" }
  | { kind: "day"; word: string; partOfDay?: "morning" | "afternoon" | "evening" }
  | { kind: "pricing"; tier?: "starter" | "booking" | "assistant" | "overview" }
  | { kind: "pay" }
  | { kind: "human" }
  | { kind: "human_mode"; mode: "phone" | "email" }
  | { kind: "audit" }
  | { kind: "what_is" }
  | { kind: "identity" }
  | { kind: "category"; category: "beauty" | "wellness" | "home_trade" | "overview" }
  | { kind: "assistant_info" }
  | { kind: "capability" }
  | { kind: "fallback" };

const DAY_WORD =
  /(?:\b|^)(today|tmrw|tomorrow|sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)(?:\b|$)/i;

const MORNING = /\bmorning\b/i;
const AFTERNOON = /\bafternoon\b/i;
const EVENING = /\bevening|night\b/i;

const CLOCK_RE = /(around|about|after|before|by)?\s*\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

// Human intent — wants to talk to a person
const HUMAN_RE =
  /\b(talk to (a )?(human|person|someone|rep|agent|marlon)|speak to (a )?(human|person|someone|rep|agent|marlon)|human support|can i talk to|can i speak to|i want to talk|need to speak)\b/i;

// Short standalone mode replies — "phone" / "email" as full input
const HUMAN_MODE_PHONE_RE = /^(?:phone|call|phone call)$/i;
const HUMAN_MODE_EMAIL_RE = /^(?:email|e-mail|email me|just email)$/i;

// "What is Replicant" / what do you do — about the COMPANY
const WHAT_IS_RE =
  /\b(what (?:is|are|does) (?:replicant|this|your (?:company|service|business))|tell me about (?:replicant|your (?:company|service|business))|what do you do|what does replicant do)\b/i;

// "Are you AI / a bot / a human / a person" — about the ASSISTANT
const IDENTITY_RE =
  /\b(are you (?:an? )?(?:ai|bot|robot|human|person|real|chatbot)|is this (?:an? )?(?:ai|bot|chatbot|human)|am i (?:talking|speaking) (?:to|with) (?:an? )?(?:ai|bot|human|person|real)|who are you|what are you)\b/i;

// Audit intent
const AUDIT_RE =
  /\b(audit|free audit|website audit|review my (?:site|website)|look at my (?:site|website))\b/i;

// Assistant upgrade intent
const ASSISTANT_RE =
  /\b(assistant|ai assistant|chatbot|ai upgrade|automation|automated|add-on|addon)\b/i;

// Pricing — overview and specific tiers
const PRICING_RE = /\b(price|pricing|cost|how much|fee|fees|rates?|charge|package|packages|included|whats in|what'?s in|tier|tiers|plan|plans)\b|\$\s?\d{2,4}/i;
const PRICING_STARTER_RE = /\b(starter|cheap(?:est)?|basic|simple|just (?:a )?site)\b|\$?\s?750\b/i;
const PRICING_BOOKING_RE = /\b(booking|quote|middle|recommended)\b|\$?\s?1[,.]?250\b|\$?\s?1[,.]?000\b/i;
const PRICING_ASSISTANT_RE = /\b(assistant|site \+ assistant|with (?:an? )?assistant)\b|\$?\s?2[,.]?000\b/i;

// Category questions
const CAT_BEAUTY_RE =
  /\b(barber\w*|salon\w*|hair\w*|beauty|braider\w*|braids?|nails?|nail tech|lash\w*|eyebrow\w*|brows?|wax\w*|makeup|stylist\w*|cosmetolog\w*|hairdress\w*)\b/i;
const CAT_WELLNESS_RE =
  /\b(med ?spa\w*|spa\w*|massage\w*|esthetic\w*|aesthetic\w*|wellness|fitness|trainer\w*|gym\w*|yoga|pilates|coach\w*|chiropract\w*|acupunctur\w*|therap\w*|nutrition\w*|dietit\w*)\b/i;
const CAT_HOME_TRADE_RE =
  /\b(lawn ?care|landscap\w*|plumb\w*|hvac|electric(?:al|ian)?|pressure ?wash\w*|handy\w*|contractor\w*|construct\w*|clean\w*|roof\w*|paint\w*|fenc\w*|gutter\w*|pest\s?control|mover\w*|moving|detail\w*|locksmith\w*|tow\w*|carpet\w*|tree (?:service|removal|trim\w*))\b/i;
const CAT_OVERVIEW_RE =
  /\b(categor(?:y|ies)|industries|verticals?|types? of business|who (?:do you|is this) for|what (?:kind|type) of business)\b/i;

// Capability fallback — generic "can it / does it / how does it work"
const CAPABILITY_RE =
  /\b(can it|is it possible|does it|do you|support|handle|integrate|work with|how (?:does|do) (?:it|this|that) work|how it works|features?|capabilit(?:y|ies))\b/i;

function clockToPartOfDay(text: string): "morning" | "afternoon" | "evening" | undefined {
  const m = text.toLowerCase().match(CLOCK_RE);
  if (!m) return undefined;
  let hh = parseInt(m[2], 10);
  const ap = (m[4] || "") as "am" | "pm" | "";

  if (ap === "am") return "morning";
  if (ap === "pm") {
    if (hh >= 5 && hh <= 8) return "evening";
    return "afternoon";
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

  // Short mode replies (must come BEFORE other checks because they're standalone words)
  if (HUMAN_MODE_PHONE_RE.test(t)) return { kind: "human_mode", mode: "phone" };
  if (HUMAN_MODE_EMAIL_RE.test(t)) return { kind: "human_mode", mode: "email" };

  // Money & checkout
  if (/\b(checkout|pay( now)?|buy)\b/.test(low)) return { kind: "pay" };

  // Identity check ("are you AI?", "who are you?") — must come BEFORE WHAT_IS_RE
  if (IDENTITY_RE.test(low)) return { kind: "identity" };

  // "What is Replicant?" / what does Replicant do
  if (WHAT_IS_RE.test(low)) return { kind: "what_is" };

  // Audit intent
  if (AUDIT_RE.test(low)) return { kind: "audit" };

  // Categories — specific business types
  if (CAT_BEAUTY_RE.test(low)) return { kind: "category", category: "beauty" };
  if (CAT_WELLNESS_RE.test(low)) return { kind: "category", category: "wellness" };
  if (CAT_HOME_TRADE_RE.test(low)) return { kind: "category", category: "home_trade" };
  if (CAT_OVERVIEW_RE.test(low)) return { kind: "category", category: "overview" };

  // Human handoff request
  if (HUMAN_RE.test(low)) return { kind: "human" };

  // Pricing — try to detect specific tier first, fall back to overview
  if (PRICING_RE.test(low)) {
    if (PRICING_ASSISTANT_RE.test(low)) return { kind: "pricing", tier: "assistant" };
    if (PRICING_STARTER_RE.test(low)) return { kind: "pricing", tier: "starter" };
    if (PRICING_BOOKING_RE.test(low)) return { kind: "pricing", tier: "booking" };
    return { kind: "pricing", tier: "overview" };
  }

  // Assistant / add-on questions (not pricing)
  if (ASSISTANT_RE.test(low)) return { kind: "assistant_info" };

  // Scheduling / availability — only when user explicitly mentions booking/calls
  if (
    /\b(book|schedule|set up|hop on)\b.*\b(call|meeting|meet|phone)\b/.test(low) ||
    /\b(available|availability|times?|time slots?|slots?)\b/.test(low) ||
    (CLOCK_RE.test(low) && /\b(call|meet|talk)\b/.test(low))
  ) {
    return { kind: "book" };
  }

  // Day + part-of-day
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
  if (byWords) return { kind: "day", word: "part-of-day", partOfDay: byWords as any };

  // Generic capability questions — fall through to website-first explanation
  if (CAPABILITY_RE.test(low)) return { kind: "capability" };

  return { kind: "fallback" };
}

/* ---------- Phase 3B: Qualification answer matcher ---------- */

/** Skip / opt-out phrases — applied across all fields. */
const QUAL_SKIP_RE = /\b(skip|not sure|i ?don'?t know|no idea|not now|dunno|whatever)\b/i;

/** Per-field answer detection. Returns canonical Airtable single-select value or null. */
function matchBusinessCategory(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(barber|salon|braid|lash|nail|hair|stylist|grooming|beauty)\b/.test(t)) return "Beauty & Grooming";
  if (/\b(spa|massage|wellness|fitness|coach|aesthetic|med ?spa|therap)\b/.test(t)) return "Wellness & Aesthetics";
  if (/\b(plumb|hvac|lawn|landscap|clean|contract|handy|trade|pressure ?wash|roof|electric|paint)\b/.test(t)) return "Home & Trade Services";
  if (/\b(other|something else|none|different)\b/.test(t)) return "Other";
  return null;
}

function matchMainGoal(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(more bookings?|book(ing)?s?|appointment)\b/.test(t)) return "More bookings";
  if (/\b(more calls?|phone calls?|ringing)\b/.test(t)) return "More calls";
  if (/\b(quotes?|estimates?|quote requests?)\b/.test(t)) return "More quote requests";
  if (/\b(consultation|consult)\b/.test(t)) return "More consultations";
  if (/\b(presence|visibility|visible|found|google|seo|online)\b/.test(t)) return "Better online presence";
  return null;
}

function matchDesiredTimeline(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(asap|right now|immediately|urgent|today|this week)\b/.test(t)) return "ASAP";
  if (/\b(1.?2 ?weeks?|two weeks?|week or two|couple weeks?)\b/.test(t)) return "1–2 weeks";
  if (/\b(this month|by end of month|within (the )?month)\b/.test(t)) return "This month";
  if (/\b(explor|brows|just (lookin|seeing|checking)|curious|window|no rush)\b/.test(t)) return "Just exploring";
  return null;
}

function matchBudgetRange(text: string): string | null {
  const t = text.toLowerCase();

  // Keyword/phrase matchers first
  if (/\b(under \$?500|less than \$?500|cheap|nothing|small budget|tight)\b/.test(t)) return "Under $500";
  if (/\$?500\s*(to|-|–)\s*\$?1[,.]?000|five hundred/.test(t)) return "$500–$1,000";
  if (/\$?1[,.]?000\s*(to|-|–)\s*\$?2[,.]?500|\bone thousand\b/.test(t)) return "$1,000–$2,500";
  if (/\$?2[,.]?500\+|more than \$?2[,.]?000|premium|whatever it takes/.test(t)) return "$2,500+";

  // Numeric fallback — extract any dollar-ish number, normalize "1k" / "2.5k", bucket it
  // Matches: "1500", "$1500", "$1,500", "1500 bucks", "around 1.5k", "2k", "2.5k"
  let n: number | null = null;
  const kMatch = t.match(/\$?\s*(\d+(?:\.\d+)?)\s*k\b/);
  if (kMatch) {
    n = parseFloat(kMatch[1]) * 1000;
  } else {
    const numMatch = t.match(/\$?\s*(\d{1,2}[,.]?\d{3}|\d{3,5})\b/);
    if (numMatch) {
      n = parseInt(numMatch[1].replace(/[,.]/g, ""), 10);
    }
  }
  if (n !== null && n > 0) {
    if (n < 500) return "Under $500";
    if (n < 1000) return "$500–$1,000";
    if (n < 2500) return "$1,000–$2,500";
    return "$2,500+";
  }

  return null;
}

/**
 * Try to match the user's text against the currently-pending qualification field.
 * Returns the canonical Airtable value, or "__SKIP__" for skip phrases, or null if no match.
 */
export function matchQualificationAnswer(
  text: string,
  pendingField: QualificationField
): string | null {
  if (!text || !text.trim()) return null;

  // Skip phrases are universal
  if (QUAL_SKIP_RE.test(text)) {
    switch (pendingField) {
      case "businessCategory":
        return "Other";
      case "desiredTimeline":
        return "Just exploring";
      case "mainGoal":
      case "budgetRange":
        return "__SKIP__";
    }
  }

  switch (pendingField) {
    case "businessCategory":
      return matchBusinessCategory(text);
    case "mainGoal":
      return matchMainGoal(text);
    case "desiredTimeline":
      return matchDesiredTimeline(text);
    case "budgetRange":
      return matchBudgetRange(text);
  }
}
