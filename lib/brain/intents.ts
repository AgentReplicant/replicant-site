// lib/brain/intents.ts

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
const PRICING_RE = /\b(price|pricing|cost|how much|fee|fees|rates?|charge)\b/i;
const PRICING_STARTER_RE = /\b(starter|cheap(?:est)?|basic|simple|just (?:a )?site)\b/i;
const PRICING_BOOKING_RE = /\b(booking|quote|middle|recommended)\b/i;
const PRICING_ASSISTANT_RE = /\b(assistant|site \+ assistant|with (?:an? )?assistant)\b/i;

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
