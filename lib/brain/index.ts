// lib/brain/index.ts
import { detectIntent, matchQualificationAnswer } from "./intents";
import { copy } from "./copy/en";
import { getSlots, bookSlot } from "./actions";
import type { BrainCtx, BrainResult, Slot } from "./types";
import type {
  PickSlotPayload,
  QualificationField,
  QualificationState,
} from "@/lib/shared/types";

/* ---------- Part-of-day windows (ET) ---------- */
const POD: Record<"morning" | "afternoon" | "evening", [number, number]> = {
  morning: [8 * 60, 11 * 60 + 59],
  afternoon: [12 * 60, 16 * 60 + 59],
  evening: [17 * 60, 20 * 60 + 59],
};

/* ---------- Helpers ---------- */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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
  if (!slots.length) return "I'm not seeing anything there.";
  const byDay = new Map<string, string[]>();
  for (const s of slots) {
    const atIdx = s.label.indexOf(" at ");
    const day = atIdx !== -1 ? s.label.slice(0, atIdx) : s.label.split(" ")[0];
    const time = atIdx !== -1 ? s.label.slice(atIdx + 4) : s.label;
    const arr = byDay.get(day) || [];
    arr.push(time);
    byDay.set(day, arr);
  }
  const parts: string[] = [];
  for (const [day, times] of byDay) {
    const short = times.slice(0, capPerDay);
    if (short.length === 1) parts.push(`${day} at ${short[0]}`);
    else if (short.length === 2) parts.push(`${day} at ${short[0]} or ${short[1]}`);
    else parts.push(`${day} at ${short[0]}, ${short[1]}, or ${short[2]}`);
  }
  if (parts.length === 1) return `I can do ${parts[0]}.`;
  const last = parts[parts.length - 1];
  return `I can do ${parts.slice(0, -1).join("; ")}, or ${last}.`;
}

/* ---------- Optional tone smoothing ---------- */
async function tone(text: string, _ctx: BrainCtx): Promise<string> {
  if (!process.env.LLM_ENABLED || process.env.LLM_ENABLED === "0" || !process.env.OPENAI_API_KEY) return text;
  try {
    const { default: OpenAI } = await import("openai");
    const client: any = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const system = [
      "You are Riley, Replicant's site assistant.",
      "Replicant builds professional websites for service businesses (beauty, wellness, home & trade).",
      "Replicant assistants are an upcoming optional upgrade for those websites.",
      "Tone: clear, professional, consultative, helpful. Not pushy, not over-chatty.",
      "1–2 short sentences unless asked to expand.",
      "Never describe websites as 'AI-built' or 'AI-generated.' Websites are professional. AI/assistants are an optional upgrade.",
      "Calls are an escalation path, not the default. Don't push scheduling unless the user asks.",
      "If asked whether you are AI, answer honestly but don't lead with it. You are Replicant's site assistant; if the user needs a person, offer to route them to Marlon.",
      "Preserve URLs exactly as written. If the source contains /website-audit or /get-started, keep that exact text in your output — do not rephrase, remove, or reformat URLs.",
      "Do NOT convert URLs to Markdown links. Do NOT wrap URLs in brackets or parentheses. Do NOT prepend a domain. Write /website-audit and /get-started as plain literal text — for example: 'at /website-audit' — never '[/website-audit](https://example.com/website-audit)'.",
    ].join(" ");
    const resp = await client.chat.completions.create({
      model: process.env.LLM_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Rewrite naturally in the Replicant assistant voice:\n---\n${text}\n---` },
      ],
    });
    const out = resp?.choices?.[0]?.message?.content?.trim() || text;
    return normalizeCtaLinks(out);
  } catch {
    return text;
  }
}

/**
 * Strip Markdown link wrappers around our CTA paths. The LLM often "helpfully"
 * converts /website-audit and /get-started into [/website-audit](https://...)
 * even when told not to. We force them back to plain literal paths so the
 * widget can detect them and render inline clickable links.
 */
function normalizeCtaLinks(text: string): string {
  return text
    // [/website-audit](https://...anything...) → /website-audit
    .replace(/\[\/website-audit\]\([^)]*\)/gi, "/website-audit")
    .replace(/\[\/get-started\]\([^)]*\)/gi, "/get-started")
    // Bare full URLs back to relative paths
    .replace(/https?:\/\/[^\s)]*\/website-audit/gi, "/website-audit")
    .replace(/https?:\/\/[^\s)]*\/get-started/gi, "/get-started");
}

function norm(s?: string) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").replace(/[.,!?;:()\[\]'"]/g, "").trim();
}

async function say(text: string, ctx: BrainCtx): Promise<string> {
  const t = await tone(text, ctx);
  // If we'd repeat ourselves verbatim, fall back to soft alternative
  if (norm(t) === norm(ctx.lastAssistant)) {
    return await tone(copy.softFallback, ctx);
  }
  return t;
}

/* ---------- Email validation for handoff ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/* ---------- Phase 3B: Qualification helpers ---------- */

/** Order in which qualification questions are asked. */
const QUAL_ORDER: QualificationField[] = [
  "businessCategory",
  "mainGoal",
  "desiredTimeline",
  "budgetRange",
];

/** Intents that trigger a qualification opener (answer first, then ask). */
const TRIGGER_INTENTS = new Set([
  "audit",
  "pricing",
  "category",
  "assistant_info",
  "capability",
]);

/** Intents where qualification re-prompts are suppressed (sacred conversational anchors). */
const NO_REPROMPT_INTENTS = new Set([
  "identity",
  "what_is",
  "human",
  "human_mode",
  "book",
  "day",
  "fallback",
]);

/** Map category intent values to canonical Airtable Business Category single-select values. */
function categoryIntentToAirtable(cat: string): string | null {
  if (cat === "beauty") return "Beauty & Grooming";
  if (cat === "wellness") return "Wellness & Aesthetics";
  if (cat === "home_trade") return "Home & Trade Services";
  return null;
}

/** Detect first-person business framing ("my barber shop", "I own a salon"). */
function isFirstPersonBusinessFraming(text: string): boolean {
  return /\b(my|i (own|run|have)|our|we're a|we are a)\b.{0,40}\b(shop|salon|business|company|practice|spa|service|firm)\b/i.test(text);
}

/** Pick the first field that hasn't been answered yet. */
function nextPendingField(q: QualificationState | undefined): QualificationField | undefined {
  if (!q) return "businessCategory";
  for (const f of QUAL_ORDER) {
    if (!q[f]) return f;
  }
  return undefined; // all collected
}

/** Prompt copy for asking a specific field. */
function promptForField(field: QualificationField): string {
  switch (field) {
    case "businessCategory":
      return copy.qualifyAskCategory;
    case "mainGoal":
      return copy.qualifyAskGoal;
    case "desiredTimeline":
      return copy.qualifyAskTimeline;
    case "budgetRange":
      return copy.qualifyAskBudget;
  }
}

/** Recommendation logic. Returns { package, message, link }. */
function recommendPackage(q: QualificationState): {
  pkg: string;
  message: string;
  link?: string;
} {
  const budget = q.budgetRange;
  const goal = q.mainGoal;

  // Under $500: honest disclosure, route to audit, no package recommendation
  if (budget === "Under $500") {
    return {
      pkg: "Not Sure Yet",
      message: copy.qualifyRecommendUnderBudget,
      link: "/website-audit",
    };
  }

  // $2,500+ → Site + Assistant
  if (budget === "$2,500+") {
    return {
      pkg: "Website + Replicant Assistant",
      message: copy.qualifyRecommendAssistant,
      link: "/get-started",
    };
  }

  // High-intent service goals → Booking/Quote regardless of budget tier (within mid-range)
  const bookingGoals = new Set(["More bookings", "More quote requests", "More consultations"]);
  if (goal && bookingGoals.has(goal) && (budget === "$500–$1,000" || budget === "$1,000–$2,500")) {
    return {
      pkg: "Booking / Quote Website",
      message: copy.qualifyRecommendBookingQuote,
      link: "/website-audit",
    };
  }

  // $1,000–$2,500 default → Booking/Quote
  if (budget === "$1,000–$2,500") {
    return {
      pkg: "Booking / Quote Website",
      message: copy.qualifyRecommendBookingQuote,
      link: "/website-audit",
    };
  }

  // $500–$1,000 default → Starter
  if (budget === "$500–$1,000") {
    return {
      pkg: "Starter Website",
      message: copy.qualifyRecommendStarter,
      link: "/website-audit",
    };
  }

  // Fallback (shouldn't reach here if all fields collected)
  return {
    pkg: "Not Sure Yet",
    message: copy.qualifyRecommendUnsure,
    link: "/website-audit",
  };
}

/**
 * Post-process an intent branch's BrainResult, attaching qualification behavior:
 *  - If intent is a TRIGGER and qualification isn't active yet → append opener, set active.
 *  - If qualification is active+pending and intent is NON-trigger NON-suppressed →
 *    append re-prompt; if repromptCount would exceed 1, deactivate instead.
 *
 * Only mutates result.text and result.qualification. Other fields untouched.
 * Operates only on { type: "text" } results.
 */
async function withQualification(
  result: BrainResult,
  kind: string,
  ctx: BrainCtx,
  intent: any
): Promise<BrainResult> {
  if (result.type !== "text") return result;
  const q = ctx.qualification;

  // Case 1: trigger intent and qualification not yet active
  if (TRIGGER_INTENTS.has(kind) && !q?.active && !q?.pendingField) {
    // Hybrid category pre-fill rule (locked decision):
    //  - First-person framing ("my barber shop") → infer + save category, skip to next field
    //  - Generic category question ("do you build for barbers?") → confirm first
    let qualificationPatch: Partial<QualificationState> = {};
    const userText = ctx.lastUser || "";

    if (kind === "category" && intent?.category && intent.category !== "overview") {
      const airtableCat = categoryIntentToAirtable(intent.category);
      if (airtableCat) {
        if (isFirstPersonBusinessFraming(userText)) {
          // Infer + save, jump to next field
          const nextField = nextPendingField({ active: true, businessCategory: airtableCat });
          const ask = nextField ? await say(promptForField(nextField), ctx) : "";
          return {
            ...result,
            text: ask ? `${result.text} ${ask}` : result.text,
            qualification: {
              active: true,
              businessCategory: airtableCat,
              pendingField: nextField,
            },
          };
        } else {
          // Generic category question — confirm before saving
          const confirmAsk = await say(copy.qualifyConfirmCategory(airtableCat), ctx);
          return {
            ...result,
            text: `${result.text} ${confirmAsk}`,
            qualification: {
              active: true,
              pendingCategoryConfirm: airtableCat,
              pendingField: "businessCategory",
            },
          };
        }
      }
    }

    // Standard opener: ask the first pending field
    const nextField = nextPendingField(q);
    if (nextField) {
      const ask = await say(promptForField(nextField), ctx);
      return {
        ...result,
        text: `${result.text} ${ask}`,
        qualification: { active: true, pendingField: nextField, ...qualificationPatch },
      };
    }
  }

  // Case 3: qualification active+pending AND a trigger intent fired.
  // The user is asking a related question (pricing, audit, etc.) mid-qualification.
  // Answer it AND softly re-prompt back to the pending field. Don't count this
  // as an "ignored" turn — they're engaged, just clarifying.
  if (q?.active && q.pendingField && TRIGGER_INTENTS.has(kind)) {
    const fieldPrompt = q.pendingCategoryConfirm
      ? copy.qualifyConfirmCategory(q.pendingCategoryConfirm)
      : promptForField(q.pendingField);
    const reprompt = await say(copy.qualifyReprompt(fieldPrompt), ctx);
    return {
      ...result,
      text: `${result.text} ${reprompt}`,
      // No qualification patch — state is preserved by widget since we don't overwrite
    };
  }

  // Case 2: qualification active+pending, intent is a non-trigger non-suppressed real intent.
  // User ignored the pending field. Re-prompt once; on 2nd ignore, deactivate.
  if (
    q?.active &&
    q.pendingField &&
    !TRIGGER_INTENTS.has(kind) &&
    !NO_REPROMPT_INTENTS.has(kind)
  ) {
    const currentCount = q.repromptCount ?? 0;
    if (currentCount >= 1) {
      // Already re-prompted once and got ignored → deactivate, keep collected data
      return {
        ...result,
        qualification: { active: false, pendingField: undefined, repromptCount: 0 },
      };
    }
    // Append a soft re-prompt
    const fieldPrompt = q.pendingCategoryConfirm
      ? copy.qualifyConfirmCategory(q.pendingCategoryConfirm)
      : promptForField(q.pendingField);
    const reprompt = await say(copy.qualifyReprompt(fieldPrompt), ctx);
    return {
      ...result,
      text: `${result.text} ${reprompt}`,
      qualification: { repromptCount: currentCount + 1 },
    };
  }

  return result;
}

/* ---------- Brain ---------- */
export async function brainProcess(input: any, ctx: BrainCtx): Promise<BrainResult> {
  const userText = typeof input?.message === "string" ? input.message : "";
  const intent = detectIntent(userText);
  const kind: string = (intent as any)?.kind;
  const q = ctx.qualification;

  /* ---------- Phase 3B: Qualification answer interception ---------- */
  // Runs BEFORE intent branches, but AFTER pickSlot. If the user is answering
  // a pending qualification question, advance state and return; otherwise fall
  // through and let normal intent dispatch handle it (with possible re-prompt).
  //
  // Note: we INCLUDE fallback here because qualification answers like
  // "more bookings" are classified as fallback by detectIntent. The
  // NO_REPROMPT_INTENTS suppression applies to real anchor intents only
  // (identity, what_is, human, human_mode, book, day) — fallback gets the
  // qualification check first, and only falls through if no match.
  if (
    !input?.pickSlot &&
    q?.active &&
    q.pendingField &&
    !["identity", "what_is", "human", "human_mode", "book", "day"].includes(kind)
  ) {
    // Special case: pending category confirmation (from "do you build for barbers?")
    if (q.pendingCategoryConfirm) {
      const yes = /^\s*(yes|yeah|yep|yup|correct|right|that'?s right|exactly|sure)\b/i.test(userText);
      const no = /^\s*(no|nope|nah|not (really|quite)|different)\b/i.test(userText);
      if (yes) {
        const nextField = nextPendingField({ ...q, businessCategory: q.pendingCategoryConfirm });
        const ask = nextField ? await say(promptForField(nextField), ctx) : "";
        return {
          type: "text",
          text: ask || (await say(copy.qualifyRecommendUnsure, ctx)),
          qualification: {
            businessCategory: q.pendingCategoryConfirm,
            pendingCategoryConfirm: undefined,
            pendingField: nextField,
            active: !!nextField,
          },
        };
      }
      if (no) {
        const ask = await say(copy.qualifyAskCategory, ctx);
        return {
          type: "text",
          text: ask,
          qualification: {
            pendingCategoryConfirm: undefined,
            pendingField: "businessCategory",
          },
        };
      }
      // Neither yes nor no — fall through, treat as normal intent
    }

    const matched = matchQualificationAnswer(userText, q.pendingField);
    if (matched) {
      // Build the updated qualification snapshot
      const updated: QualificationState = { ...q };
      if (matched !== "__SKIP__") {
        (updated as any)[q.pendingField] = matched;
      }
      const nextField = nextPendingField(updated);

      // All fields collected → recommend a package
      if (!nextField) {
        const rec = recommendPackage(updated);
        const t = await say(rec.message, ctx);
        return {
          type: "text",
          text: t,
          meta: rec.link ? { link: rec.link } : undefined,
          qualification: {
            ...(matched !== "__SKIP__" ? { [q.pendingField]: matched } : {}),
            recommendedPackage: rec.pkg,
            pendingField: undefined,
            active: false,
          },
        };
      }

      // More fields to ask → ask next
      const t = await say(promptForField(nextField), ctx);
      return {
        type: "text",
        text: t,
        qualification: {
          ...(matched !== "__SKIP__" ? { [q.pendingField]: matched } : {}),
          pendingField: nextField,
          active: true,
        },
      };
    }

    // No match for pending field. If intent is fallback/identity/etc., let the
    // normal intent branch handle it without re-prompt accounting. Otherwise,
    // append a single re-prompt; on 2nd ignore, deactivate qualification.
    // (Continues to normal intent dispatch below — we annotate state after.)
  }

  /* ---------- Final booking (client passes pickSlot) — phone-only MVP ---------- */
  if (input?.pickSlot) {
    const { start, end, email, phone, name } = (input.pickSlot ||
      {}) as Partial<PickSlotPayload>;
    if (!start || !end || !email)
      return { type: "error", text: "I'll need an email to confirm the booking." };
    if (!phone)
      return { type: "error", text: "I'll need a phone number to book the call." };
    try {
      const r = await bookSlot({
        start, end, email,
        phone,
        name: name || "",
      });
      return { type: "booked", when: r.when };
    } catch {
      return { type: "error", text: "Couldn't book that time — want to try another?" };
    }
  }

  /* ---------- Identity ("are you AI?", "who are you?") ---------- */
  if (kind === "identity") {
    // Skip tone-smoothing for identity — keep the answer consistent
    return { type: "text", text: copy.identity };
  }

  /* ---------- "What is Replicant?" ---------- */
  if (kind === "what_is") {
    const t = await say(`${copy.whatIsReplicant} ${copy.routeToAudit}`, ctx);
    return { type: "text", text: t, meta: { link: "/website-audit" } };
  }

  /* ---------- Categories ---------- */
  if (kind === "category") {
    const cat = (intent as any).category as "beauty" | "wellness" | "home_trade" | "overview";
    let text: string;
    let link: string | undefined;
    if (cat === "beauty") { text = `${copy.categoryBeauty} ${copy.routeToAudit}`; link = "/website-audit"; }
    else if (cat === "wellness") { text = `${copy.categoryWellness} ${copy.routeToAudit}`; link = "/website-audit"; }
    else if (cat === "home_trade") { text = `${copy.categoryHomeTrade} ${copy.routeToAudit}`; link = "/website-audit"; }
    else text = `${copy.categoriesOverview} Which one fits your business?`;
    const t = await say(text, ctx);
    const categoryResult: BrainResult = link
      ? { type: "text", text: t, meta: { link } }
      : { type: "text", text: t };
    return await withQualification(categoryResult, kind, ctx, intent);
  }

  /* ---------- Pricing ---------- */
  if (kind === "pricing") {
    const tier = (intent as any).tier as "starter" | "booking" | "assistant" | "overview" | undefined;
    let text: string;
    let link: string;
    if (tier === "starter") { text = `${copy.pricingStarter} ${copy.routeToAudit}`; link = "/website-audit"; }
    else if (tier === "booking") { text = `${copy.pricingBookingQuote} ${copy.routeToAudit}`; link = "/website-audit"; }
    else if (tier === "assistant") { text = `${copy.pricingSiteAssistant} ${copy.routeToGetStarted}`; link = "/get-started"; }
    else { text = `${copy.pricingOverview} ${copy.routeToAudit}`; link = "/website-audit"; }
    const t = await say(text, ctx);
    return await withQualification({ type: "text", text: t, meta: { link } }, kind, ctx, intent);
  }

  /* ---------- Audit intent ---------- */
  if (kind === "audit") {
    const text = `${copy.auditPitch} ${copy.auditLink}`;
    const t = await say(text, ctx);
    return await withQualification({ type: "text", text: t, meta: { link: "/website-audit" } }, kind, ctx, intent);
  }

  /* ---------- Assistant upgrade interest ---------- */
  if (kind === "assistant_info") {
    const t = await say(`${copy.assistantStatus}`, ctx);
    return await withQualification({ type: "text", text: t, meta: { link: "/get-started" } }, kind, ctx, intent);
  }

  /* ---------- Human mode reply — phone / email ---------- */
  if (kind === "human_mode") {
    const chosenMode = (intent as any).mode as "phone" | "email";
    if (chosenMode === "email") {
      // Skip tone-smoothing — we need the exact phrase to trigger email_handoff state in widget
      return { type: "text", text: copy.emailHandoff };
    }
    // phone
    const t = await say("Phone works. What day works for you — or morning, afternoon, or evening? (ET.)", ctx);
    return { type: "text", text: t };
  }

  /* ---------- Human intent → offer phone / Meet / email ---------- */
  if (kind === "human") {
    const t = await say(copy.humanOffer, ctx);
    return { type: "text", text: t };
  }

  /* ---------- Pay (Stripe checkout) — kept but deprioritized ---------- */
  if (kind === "pay") {
    // Old Stripe link is for the AI assistant product, which is now in development.
    // Route to /get-started for interest registration instead.
    const t = await say(`${copy.assistantStatus}`, ctx);
    return { type: "text", text: t, meta: { link: "/get-started" } };
  }

  /* ---------- Booking logic — preserved, only triggered when user explicitly asks ---------- */
  if (kind === "book" || kind === "day") {
    const pod = (intent as any)?.partOfDay as "morning" | "afternoon" | "evening" | undefined;

    if (!ctx.date && !pod) {
      const t = await say("What day works for you — or morning, afternoon, or evening? (ET.)", ctx);
      return { type: "text", text: t };
    }

    async function getEnabled(date: any | null, limit = 40) {
      const { slots } = await getSlots(date ?? null, 0, limit);
      return (slots as Slot[]).filter((s) => !s.disabled);
    }

    try {
      if (ctx.date && pod) {
        const dayEnabled = await getEnabled(ctx.date);
        const dayWin = filterByPod(dayEnabled, pod);
        if (dayWin.length > 0) {
          const phrase = phraseForSlots(dayWin.slice(0, 3));
          const t = await say(`${phrase} What works for you?`, ctx);
          return { type: "slots", text: t, date: ctx.date, slots: dayWin };
        }
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
          const t = await say(`${line} What's better?`, ctx);
          return { type: "slots", text: t, date: ctx.date, slots: [earliestWin, firstOnDay] };
        }
        if (firstOnDay) {
          const reqDay = dayWord(firstOnDay.start);
          const reqTime = firstOnDay.label.replace(/^... /, "");
          const t = await say(
            `${reqDay} ${pod} is full. First opening that day is ${reqTime} ET. Want that, or should I check another ${pod}?`,
            ctx
          );
          return { type: "slots", text: t, date: ctx.date, slots: [firstOnDay] };
        }
        const t = await say("That day looks packed. Should I try the next morning, or another day?", ctx);
        return { type: "text", text: t };
      }

      if (!ctx.date && pod) {
        const enabled = await getEnabled(null);
        const inWin = filterByPod(enabled, pod);
        if (inWin.length === 0) {
          const t = await say("That window looks full. Want me to check later that day or try another day?", ctx);
          return { type: "text", text: t };
        }
        const phrase = phraseForSlots(inWin.slice(0, 3));
        const t = await say(`${phrase} What works for you?`, ctx);
        return { type: "slots", text: t, date: null, slots: inWin };
      }

      if (ctx.date && !pod) {
        const enabled = await getEnabled(ctx.date);
        if (enabled.length === 0) {
          const t = await say("I'm not seeing openings that day. Try another day, or give me a time-of-day?", ctx);
          return { type: "text", text: t };
        }
        const phrase = phraseForSlots(enabled.slice(0, 4));
        const t = await say(`${phrase} What works for you?`, ctx);
        return { type: "slots", text: t, date: ctx.date, slots: enabled };
      }

      const t = await say("What day works for you — or morning, afternoon, or evening? (ET.)", ctx);
      return { type: "text", text: t };
    } catch {
      return { type: "error", text: "Couldn't fetch times — mind trying again?" };
    }
  }

  /* ---------- Greet on first turn ---------- */
  if (!ctx.historyCount || ctx.historyCount < 1) {
    const t = await say(pick(copy.greetFirstTime), ctx);
    return { type: "text", text: t };
  }

  /* ---------- Generic capability question — answer with website-first explanation ---------- */
  if (kind === "capability") {
    const text = `${copy.whatIsReplicant} ${copy.categoriesOverview} ${copy.routeToAudit}`;
    const t = await say(text, ctx);
    return await withQualification({ type: "text", text: t, meta: { link: "/website-audit" } }, kind, ctx, intent);
  }

  /* ---------- Soft fallback — never call-pushy ---------- */
  const t = await say(copy.softFallback, ctx);
  return await withQualification({ type: "text", text: t }, kind, ctx, intent);
}