import { NextRequest, NextResponse } from "next/server";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
type ChatBody =
  | { message: string; history?: ChatMessage[] }
  | { pickSlot: { start: string; end: string; email?: string }; history?: ChatMessage[] }
  | { provideEmail: { email: string }; history?: ChatMessage[] };

const STRIPE_URL = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK!;
const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";
const BOOKING_RULES_JSON = process.env.BOOKING_RULES_JSON || `{"days":[1,2,3,4,5],"startHour":10,"endHour":16,"slotMinutes":30,"minLeadHours":2}`;
const SCHEDULE_API_PATH = "/api/schedule";

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function detectIntent(message: string) {
  const m = normalize(message);
  if (/(pay|checkout|purchase|buy|subscribe|payment|pricing)/.test(m)) return "pay";
  if (/(book|schedule|call|meeting|demo|appointment)/.test(m)) return "book";
  if (/(email is|my email is|@)/.test(m)) return "email";
  return "smalltalk";
}

function parseRules() {
  try { return JSON.parse(BOOKING_RULES_JSON); } catch { return { days:[1,2,3,4,5], startHour:10, endHour:16, slotMinutes:30, minLeadHours:2 }; }
}

/** Create simple “next day” slots in BOOKING_TZ without extra deps */
function nextSlots(count = 5) {
  const rules = parseRules();
  const now = new Date();

  // helper: shift date in TZ by days, return Date at given hour:minute in that TZ, then convert to ISO
  const toTZDateAt = (base: Date, daysAdd: number, hour: number, minute: number) => {
    const target = new Date(base.getTime() + daysAdd * 24 * 60 * 60 * 1000);
    // Format pieces in TZ, then rebuild Date from those pieces in that TZ (approx; good enough for booking UI)
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: BOOKING_TZ, year: "numeric", month: "2-digit", day: "2-digit"
    });
    const parts = fmt.formatToParts(target).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {} as Record<string,string>);
    const [mm, dd, yyyy] = [parts.month, parts.day, parts.year].map(Number);
    // Build a date string in TZ and let toLocaleString handle labeling; store ISO (UTC) for API usage
    const local = new Date(Date.UTC(yyyy, mm - 1, dd, hour, minute, 0));
    return local.toISOString();
  };

  const isAllowedDay = (d: Date) => {
    // get weekday in TZ: 0=Sun..6=Sat; rules.days uses 1=Mon..5=Fri by default
    const wd = Number(new Intl.DateTimeFormat("en-US", { timeZone: BOOKING_TZ, weekday: "short" })
      .formatToParts(d).find(p => p.type === "weekday")?.value);
    // The above weekday trick is messy across locales; fallback with UTC offset approach:
    const tzNow = new Date(new Date().toLocaleString("en-US", { timeZone: BOOKING_TZ }));
    const tzDate = new Date(d.toLocaleString("en-US", { timeZone: BOOKING_TZ }));
    const weekday = tzDate.getDay(); // 0..6
    const allowed = rules.days || [1,2,3,4,5];
    return allowed.includes(weekday); // if rules.days are 1..5 (Mon..Fri), this works
  };

  const slots: { start: string; end: string; label: string }[] = [];
  let dayOffset = 0;
  const minLeadMs = (parseRules().minLeadHours ?? 2) * 60 * 60 * 1000;

  while (slots.length < count && dayOffset < 14) {
    const candidate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    if (isAllowedDay(candidate)) {
      for (let H = parseRules().startHour; H < parseRules().endHour; H++) {
        for (let M = 0; M < 60; M += parseRules().slotMinutes) {
          const startISO = toTZDateAt(now, dayOffset, H, M);
          const endISO   = toTZDateAt(now, dayOffset, H, M + parseRules().slotMinutes);
          const startDate = new Date(startISO);
          if (startDate.getTime() - now.getTime() < minLeadMs) continue;
          // Human label in TZ
          const lbl = new Date(startISO).toLocaleString("en-US", {
            timeZone: BOOKING_TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
          });
          slots.push({ start: startISO, end: endISO, label: lbl });
          if (slots.length >= count) break;
        }
        if (slots.length >= count) break;
      }
    }
    dayOffset++;
  }
  return slots;
}

function extractEmail(text: string): string | null {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // 1) Slot picked path
  if ("pickSlot" in body && body.pickSlot?.start && body.pickSlot?.end) {
    const { start, end, email } = body.pickSlot;
    if (!email) {
      return NextResponse.json({
        type: "need_email",
        text: "Great — what’s the best email to send the calendar invite to?",
        hint: "Reply with your email (e.g., me@example.com)."
      });
    }
    try {
      const base = process.env.NEXT_PUBLIC_SITE_URL || "";
      const res = await fetch(`${base}${SCHEDULE_API_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start, end, email }),
        cache: "no-store"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Schedule failed");
      return NextResponse.json({
        type: "booked",
        text: "Booked! I’ve emailed you the invite.",
        meetLink: data?.meetLink,
        when: new Date(start).toLocaleString("en-US", { timeZone: BOOKING_TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
      });
    } catch (e:any) {
      return NextResponse.json({ type: "error", text: `Couldn’t book that slot: ${e.message || e}` }, { status: 500 });
    }
  }

  // 2) Email provided path
  if ("provideEmail" in body && body.provideEmail?.email) {
    const email = body.provideEmail.email;
    // Re-propose slots now that we have an email
    const slots = nextSlots(5);
    return NextResponse.json({
      type: "slots",
      text: "Thanks! Pick a time that works:",
      email,
      slots
    });
  }

  // 3) Plain message path
  const message = (body as any).message || "";
  const intent = detectIntent(message);

  if (intent === "pay") {
    return NextResponse.json({
      type: "action",
      action: "open_url",
      url: STRIPE_URL,
      text: "You can complete payment here."
    });
  }

  if (intent === "book") {
    const email = extractEmail(message);
    if (!email) {
      const slots = nextSlots(5);
      return NextResponse.json({
        type: "slots",
        text: "Happy to book a demo. Pick a time below:",
        slots
      });
    } else {
      const slots = nextSlots(5);
      return NextResponse.json({
        type: "slots",
        text: `Got it (${email}). Pick a time below:`,
        email,
        slots
      });
    }
  }

  if (intent === "email") {
    const email = extractEmail(message);
    if (email) {
      const slots = nextSlots(5);
      return NextResponse.json({
        type: "slots",
        text: `Great — I’ll use ${email}. Choose a time:`,
        email,
        slots
      });
    }
  }

  // Default smalltalk
  return NextResponse.json({
    type: "text",
    text: "I can help you book a demo or take payment. Try “book a call” or “pay”."
  });
}
