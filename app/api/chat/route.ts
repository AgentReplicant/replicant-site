// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const STRIPE_URL = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK!;
const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";
const BOOKING_RULES_JSON =
  process.env.BOOKING_RULES_JSON ||
  `{"days":[1,2,3,4,5],"startHour":10,"endHour":16,"slotMinutes":30,"minLeadHours":2}`;
const SCHEDULE_API_PATH = "/api/schedule";

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function detectIntent(message: string) {
  const m = normalize(message);
  if (/(pay|checkout|purchase|buy|subscribe|payment|pricing|price)/.test(m)) return "pay";
  if (/(book|schedule|call|meeting|demo|appointment|available times?|options?|when can|pick a time|time slots?)/.test(m)) return "book";
  if (/(email is|my email is|@)/.test(m)) return "email";
  return "unknown";
}

function parseRules() {
  try {
    return JSON.parse(BOOKING_RULES_JSON);
  } catch {
    return { days: [1, 2, 3, 4, 5], startHour: 10, endHour: 16, slotMinutes: 30, minLeadHours: 2 };
  }
}

// Quick, dependency-free slot generator
function nextSlots(count = 5) {
  const rules = parseRules();
  const now = new Date();
  const minLeadMs = (rules.minLeadHours ?? 2) * 60 * 60 * 1000;

  const isAllowedDay = (d: Date) => {
    const weekday = new Date(d.toLocaleString("en-US", { timeZone: BOOKING_TZ })).getDay(); // 0..6
    const allowed = rules.days || [1, 2, 3, 4, 5];
    return allowed.includes(weekday);
  };

  const toTZISO = (base: Date, daysAdd: number, hour: number, min: number) => {
    const target = new Date(base.getTime() + daysAdd * 86400000);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: BOOKING_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(target)
      .reduce((acc: any, p) => ((acc[p.type] = p.value), acc), {});
    const yyyy = Number(parts.year);
    const mm = Number(parts.month);
    const dd = Number(parts.day);
    const dt = new Date(Date.UTC(yyyy, mm - 1, dd, hour, min, 0));
    return dt.toISOString();
  };

  const out: { start: string; end: string; label: string }[] = [];
  let dayOffset = 0;
  while (out.length < count && dayOffset < 14) {
    const candidate = new Date(now.getTime() + dayOffset * 86400000);
    if (isAllowedDay(candidate)) {
      for (let H = rules.startHour; H < rules.endHour; H++) {
        for (let M = 0; M < 60; M += rules.slotMinutes) {
          const start = toTZISO(now, dayOffset, H, M);
          const end = toTZISO(now, dayOffset, H, M + rules.slotMinutes);
          if (new Date(start).getTime() - now.getTime() < minLeadMs) continue;
          const label = new Date(start).toLocaleString("en-US", {
            timeZone: BOOKING_TZ,
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
          out.push({ start, end, label });
          if (out.length >= count) break;
        }
        if (out.length >= count) break;
      }
    }
    dayOffset++;
  }
  return out;
}

function extractEmail(text: string): string | null {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // 1) Slot picked
  if ("pickSlot" in body && body.pickSlot?.start && body.pickSlot?.end) {
    const { start, end, email } = body.pickSlot;
    if (!email) {
      return NextResponse.json({
        type: "need_email",
        text: "Great — what’s the best email for the invite?",
      });
    }
    try {
      const base = process.env.NEXT_PUBLIC_SITE_URL || "";
      const res = await fetch(`${base}${SCHEDULE_API_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start, end, email }),
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Schedule failed");
      return NextResponse.json({
        type: "booked",
        text: "Booked! I’ve sent the calendar invite.",
        meetLink: data?.meetLink,
        when: new Date(start).toLocaleString("en-US", {
          timeZone: BOOKING_TZ,
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      });
    } catch (e: any) {
      return NextResponse.json({ type: "error", text: `Couldn’t book: ${e.message || e}` }, { status: 500 });
    }
  }

  // 2) Email provided
  if ("provideEmail" in body && body.provideEmail?.email) {
    const email = body.provideEmail.email;
    const slots = nextSlots(5);
    return NextResponse.json({ type: "slots", text: "Thanks — pick a time:", email, slots });
  }

  // 3) Plain message path
  const message: string = body.message ?? "";
  const intent = detectIntent(message);

  if (intent === "pay") {
    return NextResponse.json({
      type: "action",
      action: "open_url",
      url: STRIPE_URL,
      text: "You can complete payment here.",
    });
  }

  if (intent === "book") {
    const email = extractEmail(message) || undefined;
    const slots = nextSlots(5);
    return NextResponse.json({
      type: "slots",
      text: email ? `Got it (${email}). Pick a time:` : "Happy to book a demo. Pick a time:",
      email,
      slots,
    });
  }

  if (intent === "email") {
    const email = extractEmail(message);
    if (email) {
      const slots = nextSlots(5);
      return NextResponse.json({ type: "slots", text: `Great — I’ll use ${email}. Choose a time:`, email, slots });
    }
  }

  // Friendly default → offer slots (feels less “bot”)
  const slots = nextSlots(5);
  return NextResponse.json({
    type: "slots",
    text: "I can book you in or take payment. Here are some times:",
    slots,
  });
}
