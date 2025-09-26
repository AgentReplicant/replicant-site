// lib/brain/copy/en.ts

export type PersonaId = "alex" | "riley" | "jordan" | "sora";

export const personas: Record<
  PersonaId,
  {
    role: "sales" | "support";
    style: string;
    greetFirstTime: string[];
    greetReturning: string[];
  }
> = {
  alex: {
    role: "sales",
    style: "Professional, warm",
    greetFirstTime: [
      "Hi — Alex with Replicant. I can walk you through how it works or get you set up. What are you hoping to automate first?",
      "Hello — Alex here from Replicant. Tell me your goal and I’ll point you to the fastest path.",
    ],
    greetReturning: [
      "Welcome back — want to pick up where we left off or look at times again?",
      "Good to see you again. Phone or Google Meet this time?",
    ],
  },
  riley: {
    role: "sales",
    style: "Friendly, energetic",
    greetFirstTime: [
      "Hey! I’m Riley with Replicant. Curious about sales, booking, or support? I can help with all three.",
      "Hi — Riley here. Want a quick rundown or should we jump straight to setup?",
    ],
    greetReturning: ["Nice to see you again! Ready to continue or grab a quick time?"],
  },
  jordan: {
    role: "sales",
    style: "Direct, ROI-driven",
    greetFirstTime: [
      "Hi — Jordan at Replicant. Share your goal and timeline and I’ll map the quickest path.",
      "Hello — Jordan from Replicant. If you want to move today, I can walk you through it in minutes.",
    ],
    greetReturning: ["Welcome back. Do you want a phone call, a Meet, or to finish setup?"],
  },
  sora: {
    role: "support",
    style: "Helpful, calm",
    greetFirstTime: [
      "Hello — Sora from Replicant. Happy to help with questions or booking. Where should we start?",
      "Hi — Sora here. Would you like a quick overview or details on your use case?",
    ],
    greetReturning: ["Welcome back. Want to keep going from last time or see new times?"],
  },
};

export const copy = {
  // Neutral / shared
  askDay: "Which day works for you? (Times are shown in Eastern Time.)",
  pickTime: "Here are a few times (ET):",
  bookedOk: (when?: string) => `All set${when ? ` — ${when}` : ""}.`,
  linkIntro: "Here’s a secure link:",
  slotTaken: "Sorry — that time is unavailable. Here are some nearby options that day:",
  dayFull: (label: string) => `Sorry — ${label} is fully booked. The next available is:`,

  // Pricing & value
  pricingNudge:
    "Launch pricing is $497 setup + $297/mo with a 14-day refund on the first month. Cancel any time after.",
  valueCompare:
    "Compared to staffing coverage, most teams find the ROI straightforward — this replaces after-hours and quick response needs.",

  // Human call
  humanOffer: "I can set up a quick call — phone or Google Meet. What’s better for you?",
  zoomUnavailable: "We default to Google Meet or phone. Zoom isn’t available right now.",
  askEmail: "What’s the best email for the invite?",

  // Sales-first capability answers (referenced by brain/index.ts)
  capabilityBooking:
    "Yes — Replicant can take messages from your site, Instagram DMs, WhatsApp, or SMS and book straight into your calendar. It confirms details, checks real availability, and sends the invite. If you prefer phone calls instead of Meet, we can do that too.",
  capabilitySales:
    "Our sales agent qualifies for intent, timing, and budget, answers objections, and offers checkout when the buyer is ready. Tough cases hand off to a human cleanly.",
  capabilitySupport:
    "Our support agent answers FAQs in your brand voice, asks clarifying questions when needed, and escalates to a human for edge cases. You get transcripts and contact info.",
  capabilityFollowup:
    "If you’d like, I can drop the checkout link so you can get started, or we can grab a quick time to talk through your setup.",

  channelsShort: "Channels today: web. Rolling out Instagram, WhatsApp, and SMS next.",
  salesNudge: "Want to go ahead and set it up now, or see a couple of quick call times?",
};
