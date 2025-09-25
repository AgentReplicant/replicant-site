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
      "Hi — Alex with Replicant. I can answer questions, book a quick call, or get you set up. How can I help?",
      "Hello — Alex here from Replicant. Tell me your goal and I’ll point you to the fastest path.",
      "Hey — Alex with Replicant. Want to see availability or just ask away?",
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
      "Hey! I’m Riley with Replicant. I can book a quick call or answer anything you’re curious about.",
      "Hi — Riley here. Want to peek at availability or go straight to setup?",
    ],
    greetReturning: [
      "Nice to see you again! Ready to grab a time, or do you want a quick rundown first?",
    ],
  },
  jordan: {
    role: "sales",
    style: "Direct, ROI-driven",
    greetFirstTime: [
      "Hi — Jordan at Replicant. Tell me your goal and I’ll recommend the quickest path (call or setup).",
      "Hello — Jordan from Replicant. If you share your timeline, I can move you forward today.",
    ],
    greetReturning: [
      "Welcome back. Do you want a phone call, a Meet, or to finish setup?",
    ],
  },
  sora: {
    role: "support",
    style: "Helpful, calm",
    greetFirstTime: [
      "Hello — Sora from Replicant. Happy to help with questions or booking. Where should we start?",
      "Hi — Sora here. Would you like to see times or talk through your use case?",
    ],
    greetReturning: [
      "Welcome back. Want to keep going from last time or see new times?",
    ],
  },
};

export const copy = {
  // neutral lines the brain can use anywhere (LLM will smooth tone if enabled)
  askDay: "Which day works for you? (Times are shown in Eastern Time.)",
  pickTime: "Here are a few times (ET):",
  bookedOk: (when?: string) => `All set${when ? ` — ${when}` : ""}.`,
  linkIntro: "Here’s a secure link:",
  slotTaken: "Sorry — that time is unavailable. Here are some nearby options that day:",
  dayFull: (label: string) => `Sorry — ${label} is fully booked. The next available is:`,
  pricingNudge:
    "Launch pricing is $497 setup + $297/mo with a 14-day refund on the first month. Cancel any time after.",
  valueCompare:
    "Compared to staffing coverage, most teams find the ROI straightforward — this replaces after-hours and quick response needs.",
  humanOffer: "I can set up a quick call — phone or Google Meet. What’s better for you?",
  zoomUnavailable: "We default to Google Meet or phone. Zoom isn’t available right now.",
  askEmail: "What’s the best email for the invite?",
};
