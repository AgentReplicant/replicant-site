// lib/brain/copy/en.ts

/**
 * Single official Replicant voice.
 * Tone: clear, professional, consultative, website-first.
 * Calls are an escalation path, not the default.
 * No AI-agent-company positioning. Replicant = professional websites for service businesses.
 */

export const copy = {
  // ---------- Greetings ----------
  greetFirstTime: [
    "Hi, I'm Riley — Replicant's site assistant. I can explain website packages, help you choose the right fit, answer questions, or start your free website audit.",
    "Hey — Riley here, Replicant's site assistant. We build websites for service businesses (beauty, wellness, home & trade). Want a walkthrough, or to jump straight to a free audit?",
    "Hi, I'm Riley — Replicant's site assistant. What kind of business do you run?",
  ],
  greetReturning: [
    "Welcome back — Riley here. Want to keep going where we left off, or start fresh?",
    "Good to see you again. Happy to answer more questions or get your free website audit started.",
  ],

  // ---------- Identity (when asked "are you AI?", "are you a person?", etc.) ----------
  identity:
    "I'm Riley, Replicant's site assistant — built to answer questions, explain services, and collect details for website audits. If you need a person, I can route you to Marlon.",

  // ---------- "What is Replicant?" (canonical) ----------
  whatIsReplicant:
    "Replicant builds professional websites for service businesses, with upcoming assistant upgrades that can answer customer questions, capture leads, and help people book, call, or request quotes.",

  // ---------- Service categories ----------
  categoriesOverview:
    "We build for three kinds of service businesses: Beauty & Grooming (barbers, salons, lash, nails), Wellness & Aesthetics (med spas, massage, fitness, coaches), and Home & Trade Services (lawncare, plumbing, pressure washing, HVAC, contractors, cleaning).",

  categoryBeauty:
    "For beauty & grooming — barbers, braiders, salons, lash techs, nail techs — we build sites with clean service menus, photos, reviews, and a booking flow that links to your existing booking platform (Booksy, Square, Vagaro, etc.).",

  categoryWellness:
    "For wellness & aesthetics — med spas, massage, fitness, coaching — we build sites focused on trust and qualified consultations, with clear service descriptions, social proof, and consultation request flows.",

  categoryHomeTrade:
    "For home & trade services — lawncare, plumbing, pressure washing, handyman, HVAC, cleaning, contractors — we build sites focused on calls and quote requests, with clear service areas, photos of past work, and a fast contact path.",

  // ---------- Pricing (websites, starting-at) ----------
  pricingOverview:
    "Pricing starts at $750 for a Starter Site, $1,250 for a Booking or Quote Site (with platform integration and reviews), or $2,000 setup + monthly support for a Site + Assistant package. Final scope depends on your business and content — that's what the free audit confirms.",

  pricingStarter:
    "Starter Site starts at $750. Mobile-first website, services section, photos, contact form, booking or quote CTA, and basic SEO. Good fit for businesses that just need a clean online presence.",

  pricingBookingQuote:
    "Booking / Quote Site starts at $1,250. Everything in Starter, plus booking platform or quote form integration, reviews, Google Maps / location, and analytics. Best fit for most service businesses.",

  pricingSiteAssistant:
    "Site + Assistant starts at $2,000 setup plus monthly support. Full website plus a Replicant assistant trained on your FAQs, services, and booking flow. The assistant is in development — current sites can be upgraded once it's live.",

  // ---------- Audit ----------
  auditPitch:
    "The free website audit is the easiest place to start. Tell us about your business and what you want more of (bookings, calls, quotes), and we'll send back an honest take on what we'd improve.",
  auditLink:
    "You can request a free audit at /website-audit — takes about 3 minutes.",

  // ---------- Assistant upgrade (positioned as upcoming) ----------
  assistantStatus:
    "Replicant assistants are in development as an upgrade for websites. They're designed to answer questions, capture leads, and help customers book, call, or request quotes. If you're interested in being an early adopter, /get-started is the right place to register interest.",

  // ---------- Human handoff (now offers email as a third option) ----------
  humanOffer:
    "Happy to connect you with a real person. Would you prefer a phone call or email follow-up?",
  emailHandoff:
    "Got it — email works. What's the best email to reach you at, and a quick note on what you'd like to discuss?",
  emailReceived:
    "Thanks — I'll make sure someone follows up by email within one business day.",

  // ---------- Scheduling (for when user explicitly asks for a call) ----------
  askDay: "What day works for you? (Times are shown in Eastern Time.)",
  pickTime: "Here are a few times (ET):",
  bookedOk: (when?: string) => `All set${when ? ` — ${when}` : ""}.`,
  slotTaken:
    "That time just filled. Here are some nearby options that day:",
  dayFull: (label: string) =>
    `${label} is fully booked. The next available is:`,
  askEmail: "What's the best email for the calendar invite?",

  // ---------- Soft routing CTAs ----------
  routeToAudit:
    "If you'd like, you can request a free audit at /website-audit and I'll make sure it gets reviewed.",
  routeToGetStarted:
    "If you want to register interest in the assistant upgrade, /get-started is the right place.",

  // ---------- Generic fallback (never pushy) ----------
  softFallback:
    "I can explain what Replicant does, walk you through our packages, or help you start a free website audit. What would be most useful?",

  // ---------- Misc ----------
  linkIntro: "Here's the link:",

  // ---------- Phase 3B: Qualification ----------
  qualifyOffer:
    "I can narrow down which package fits best with a couple quick questions — sound good?",
  qualifyAskCategory:
    "What kind of business do you run — beauty & grooming (barber, salon, lash, nails), wellness & aesthetics (med spa, massage, fitness, coaching), home & trade services (plumbing, lawncare, HVAC, cleaning, contractors), or something else?",
  qualifyConfirmCategory: (cat: string) =>
    `Sounds like ${cat} — is that the type of business you run?`,
  qualifyAskGoal:
    "What are you most trying to get more of — bookings, calls, quote requests, consultations, or better online presence?",
  qualifyAskTimeline:
    "What's your timeline — ASAP, 1–2 weeks, this month, or just exploring?",
  qualifyAskBudget:
    "And what range were you thinking for the website — under $500, $500–$1,000, $1,000–$2,500, or $2,500+?",
  qualifyRecommendStarter:
    "Based on that, the Starter Website is probably the best fit — clean mobile-first site, services, photos, contact form, and a booking or quote CTA.",
  qualifyRecommendBookingQuote:
    "Based on that, the Booking / Quote Website is probably the best fit — everything in Starter, plus booking platform or quote form integration, reviews, location, and analytics.",
  qualifyRecommendAssistant:
    "Based on that, the Website + Replicant Assistant package is the right tier — full website plus an upcoming assistant trained on your services, FAQs, and booking flow.",
  qualifyRecommendUnderBudget:
    "Heads up — current website packages start at $750. The free audit is still worth doing if you're serious about improving the site, so we can show you what's possible.",
  qualifyRecommendUnsure:
    "Based on what you've shared, I'd recommend starting with the free audit so we can match the right package to your business.",
  qualifyReprompt: (fieldPrompt: string) =>
    `Want to keep narrowing down the right package? ${fieldPrompt}`,

  // ---------- Phase 6: Returning-user greetings ----------
  // Generated by lib/brain/index.ts via buildReturningGreeting(profile).
  // These are templates; the helper picks the right one based on what's known.
  returningWelcomeGeneric: "Welcome back.",
  returningWelcomeStatusOnly: "Welcome back — looks like we've already started a conversation.",

  // Phase 6: Acknowledge a category override mid-flow.
  qualifyCategoryOverride: (newCat: string) =>
    `Got it — I'll treat this as ${newCat} for now.`,
};