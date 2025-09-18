// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HistMsg = { role: "user" | "assistant"; content: string };
type Slot = { start: string; end: string; label: string; disabled?: boolean };
type Persona = "alex" | "riley" | "jordan" | "sora";

const ET_TZ = "America/New_York";

const VOICE: Record<Persona, any> = {
  alex: {
    greet: "Hello — I’m Alex, your Replicant agent. What day works for a quick Google Meet?",
    pricing:
      "Our launch pricing is **$497 setup + $297/month** — roughly **$10/day** and available **24/7**, compared to a full-time employee. Want to look at times?",
    askDay: "What day works best for you? (I’ll show times in Eastern Time.)",
    timesHeader: "Here are a few times (ET):",
    pickHelp: "Reply with **1–4** and I’ll send the invite. Prefer **video** (Google Meet) or **phone**?",
    askEmail: "What’s the best email for the calendar invite?",
    askPhone: "What number should we call?",
    booked: (when: string, meet?: string, mode?: string, phone?: string) =>
      `All set${when ? ` (${when})` : ""}!${
        mode === "phone" && phone ? `\nPhone: ${phone}` : meet ? `\nMeet link: ${meet}` : ""
      }`,
    noTimes: "I’m not seeing open times for that day. Another day work?",
    tooExpensive:
      "Totally hear you — if the fit is strong but budget is tight, there’s a path: **bring 2 sign-ups and we’ll waive your setup fee**. Want to chat options?",
    fallback: "I can help with pricing, booking, or checkout. Try: “pricing”, “book a call”, or “pay now”.",
  },
  riley: {
    greet: "Hey — I’m Riley with Replicant. What day is easiest for a quick call? I’ll share times in ET.",
    pricing:
      "**$497 setup + $297/month** — roughly **$10/day**, always-on **24/7**. Want me to show some times?",
    askDay: "What day works for you? (Times in ET.)",
    timesHeader: "I can do:",
    pickHelp: "Reply **1–4** and tell me **video** or **phone**. I’ll handle the invite.",
    askEmail: "What’s the best email for the invite?",
    askPhone: "What’s a good number to call?",
    booked: (when: string, meet?: string, mode?: string, phone?: string) =>
      `You’re booked${when ? ` (${when})` : ""}!${
        mode === "phone" && phone ? `\nWe’ll call: ${phone}` : meet ? `\nMeet: ${meet}` : ""
      }`,
    noTimes: "Hmm, I’m not seeing openings that day. Want to pick another day?",
    tooExpensive:
      "Budget matters! One option: **refer 2 sign-ups and we’ll waive your setup fee**. Open to that?",
    fallback: "Want pricing, times, or checkout? Say: “pricing”, “book a call”, or “pay now”.",
  },
  jordan: {
    greet: "I’m Jordan. Which day works? I’ll propose ET times.",
    pricing:
      "**$497 setup + $297/mo** — ~**$10/day**, operates **24/7**. Want to book a slot?",
    askDay: "Pick a day; I’ll show options in ET.",
    timesHeader: "Options (ET):",
    pickHelp: "Reply **1–4**, then **video** or **phone**.",
    askEmail: "Email for the invite?",
    askPhone: "Number to call?",
    booked: (when: string, meet?: string, mode?: string, phone?: string) =>
      `Booked${when ? ` (${when})` : ""}.${mode === "phone" && phone ? `\nPhone: ${phone}` : meet ? `\nMeet: ${meet}` : ""}`,
    noTimes: "No openings that day. Try another day.",
    tooExpensive:
      "If cost is the blocker: **2 referrals = setup fee waived**. Interested?",
    fallback: "Say “pricing”, “book a call”, or “pay now”.",
  },
  sora: {
    greet: "Hi, I’m Sora. What day works best? I’ll share ET times.",
    pricing:
      "Pricing is **$497 setup + $297/month** — about **$10/day** and available **24/7**. Want to look at times?",
    askDay: "Which day is best? Times will be shown in Eastern Time.",
    timesHeader: "Available times (ET):",
    pickHelp: "Reply **1–4** and let me know **video** or **phone**. I’ll send the invite.",
    askEmail: "What email should I use for the invite?",
    askPhone: "What number should we call?",
    booked: (when: string, meet?: string, mode?: string, phone?: string) =>
      `Great — we’re set${when ? ` (${when})` : ""}!${
        mode === "phone" && phone ? `\nWe’ll call: ${phone}` : meet ? `\nMeet: ${meet}` : ""
      }`,
    noTimes: "I don’t see openings that day. Would another day work?",
    tooExpensive:
      "We can help on budget: **2 sign-ups = setup fee waived**. Want details?",
    fallback: "I can share pricing, book time, or send checkout.",
  },
};

function stripeLink() {
  return process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || process.env.STRIPE_PAYMENT_LINK || "";
}

function asText(text: string) {
  return NextResponse.json({ type: "text", text });
}

function pickEnabled(slots: Slot[], n = 4) {
  return slots.filter((s) => !s.disabled).slice(0, n);
}

// very simple natural-day parser
const WD: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
};
function parseDay(text: string): Date | null {
  const t = text.trim().toLowerCase();
  const now = new Date();
  if (t.includes("today")) return now;
  if (t.includes("tomorrow")) return new Date(now.getTime() + 86400000);

  const m = t.match(/(next\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)/i);
  if (m) {
    const want = WD[m[2].toLowerCase()];
    const base = new Date(now);
    let daysAhead = (want - base.getDay() + 7) % 7;
    if (daysAhead === 0 || m[1]) daysAhead += 7;
    return new Date(base.getTime() + daysAhead * 86400000);
  }
  return null;
}

// Optional LLM polish
async function polish(persona: Persona, text: string) {
  if (process.env.LLM_ENABLED !== "1" || !process.env.OPENAI_API_KEY) return text;
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: `Rewrite the user-facing line to match a friendly ${persona} tone. Keep meaning. Be concise.` },
          { role: "user", content: text },
        ],
      }),
    });
    const j = await r.json();
    return j?.choices?.[0]?.message?.content?.trim() || text;
  } catch {
    return text;
  }
}

// Airtable upsert (simple)
async function upsertLead(payload: {
  email: string;
  name?: string;
  phone?: string;
  source?: string;
  status?: string;
  message?: string;
  appointmentIso?: string;
}) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || "Leads";
  if (!token || !baseId || !payload.email) return;

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  try {
    const list = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?filterByFormula=${encodeURIComponent(
        `LOWER({Email})="${payload.email.toLowerCase()}"`
      )}&maxRecords=1`,
      { headers, cache: "no-store" }
    ).then((r) => r.json());

    const fields: Record<string, any> = {
      Email: payload.email,
      ...(payload.name ? { Name: payload.name } : {}),
      ...(payload.phone ? { Phone: payload.phone } : {}),
      ...(payload.message ? { Message: payload.message } : {}),
      ...(payload.source ? { Source: payload.source } : {}),
      ...(payload.status ? { Status: payload.status } : {}),
      ...(payload.appointmentIso ? { "Appointment Time": payload.appointmentIso } : {}),
    };

    if (list.records?.[0]) {
      await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${list.records[0].id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ fields, typecast: true }),
      });
    } else {
      await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ records: [{ fields }], typecast: true }),
      });
    }
  } catch (e) {
    console.warn("[lead] upsert skipped/error:", (e as any)?.message || e);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const persona = (body?.persona as Persona) || ("alex" as Persona);
  const messageRaw = (body?.message || "").toString().trim();
  const message = messageRaw.toLowerCase();
  const pickSlot: { start: string; end: string; email?: string; mode?: "video" | "phone"; phone?: string } | undefined =
    body?.pickSlot;

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  // --- Handle booking submission
  if (pickSlot) {
    const email = (pickSlot.email || "").trim();
    if (!email) return asText(await polish(persona, VOICE[persona].askEmail));

    try {
      const resp = await fetch(`${origin}/api/schedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          start: pickSlot.start,
          end: pickSlot.end,
          email,
          mode: pickSlot.mode || "video",
          phone: pickSlot.mode === "phone" ? pickSlot.phone || "" : undefined,
        }),
        cache: "no-store",
      });
      const j = await resp.json().catch(() => ({} as any));
      if (resp.ok && j?.ok) {
        // CRM update
        await upsertLead({
          email,
          phone: pickSlot.phone,
          source: "Replicant site",
          status: "Booked",
          appointmentIso: pickSlot.start,
        });

        const line = VOICE[persona].booked(j?.when || "", j?.meetLink || j?.htmlLink || "", pickSlot.mode, pickSlot.phone);
        return NextResponse.json({
          type: "booked",
          when: j?.when || "",
          meetLink: j?.meetLink || j?.htmlLink || "",
          mode: pickSlot.mode || "video",
          phone: pickSlot.phone || "",
          text: await polish(persona, line),
        });
      }
      const err = j?.error || "Couldn’t book that time. Mind trying another option?";
      return asText(await polish(persona, err));
    } catch {
      return asText(await polish(persona, "Booking failed unexpectedly. Try “book a call” again."));
    }
  }

  // --- Quick intents
  if (message.includes("pay now") || message === "pay" || message.includes("checkout")) {
    const url = stripeLink();
    if (!url) return asText("Stripe link isn’t configured yet.");
    return NextResponse.json({
      type: "action",
      action: "open_url",
      url,
      text: await polish(persona, "You can complete setup here:"),
    });
  }

  if (message.includes("price") || message.includes("how much") || message.includes("$")) {
    return asText(await polish(persona, VOICE[persona].pricing));
  }

  if (message.includes("expensive") || message.includes("too much") || message.includes("budget")) {
    return asText(await polish(persona, VOICE[persona].tooExpensive));
  }

  // --- Day-first booking
  if (message.includes("book") || message.includes("schedule") || message.includes("call")) {
    return asText(await polish(persona, VOICE[persona].askDay));
  }

  // If they replied with a day (today/tomorrow/weekday), fetch times for that day
  const maybeDay = parseDay(message);
  if (maybeDay) {
    const y = maybeDay.getFullYear();
    const m = maybeDay.getMonth() + 1;
    const d = maybeDay.getDate();

    const url = new URL(`${origin}/api/slots`);
    url.searchParams.set("y", String(y));
    url.searchParams.set("m", String(m).padStart(2, "0"));
    url.searchParams.set("d", String(d).padStart(2, "0"));
    url.searchParams.set("limit", "12");

    try {
      const r = await fetch(url.toString(), { cache: "no-store" });
      const j = await r.json();
      const enabled: Slot[] = pickEnabled((j?.slots as Slot[]) || [], 4);
      if (!enabled.length) return asText(await polish(persona, VOICE[persona].noTimes));

      const lines = enabled.map((s, i) => `${i + 1}) ${s.label}`);
      const prompt = [VOICE[persona].timesHeader, ...lines, "", VOICE[persona].pickHelp].join("\n");

      return NextResponse.json({
        type: "text",
        text: await polish(persona, prompt),
        candidates: enabled,
      });
    } catch {
      return asText(await polish(persona, "Couldn’t load times right now. Please try again."));
    }
  }

  // default
  return asText(await polish(persona, VOICE[persona].fallback));
}
