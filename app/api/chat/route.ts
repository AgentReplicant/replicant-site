// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HistMsg = { role: "user" | "assistant"; content: string };
type Filters = { date?: { y: number; m: number; d: number }; page?: number };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const provideEmail: { email?: string } | undefined = body?.provideEmail;
  const pickSlot:
    | { start: string; end: string; email?: string; when?: string }
    | undefined = body?.pickSlot;
  const filters: Filters | undefined = body?.filters;

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  const emailFromProvide = provideEmail?.email?.trim();

  // -------------------- BOOKING --------------------
  if (pickSlot) {
    const email = (pickSlot.email || emailFromProvide || "").trim();
    if (!email) {
      return NextResponse.json({
        type: "need_email",
        text: "What email should I use for the calendar invite?",
        start: pickSlot.start,
        end: pickSlot.end,
        when: pickSlot.when,
      });
    }

    try {
      const r = await fetch(`${origin}/api/schedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startUtc: pickSlot.start,
          endUtc: pickSlot.end,
          email,
        }),
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({} as any));

      if (r.ok && j?.ok) {
        return NextResponse.json({
          type: "booked",
          when: j?.when || pickSlot.when || "",
          meetLink: j?.meetLink || j?.htmlLink || "",
        });
      }

      return NextResponse.json({
        type: "error",
        text:
          j?.error ||
          "Couldn’t book that slot (That time was just taken). Mind trying another?",
      });
    } catch (err) {
      return NextResponse.json({
        type: "error",
        text:
          "Something went wrong while booking that slot. Mind picking another time?",
      });
    }
  }

  // -------------------- SLOTS --------------------
  const date = filters?.date;
  const page = Number(filters?.page ?? 0);

  const slotsUrl = new URL(`${origin}/api/slots`);
  if (date) {
    slotsUrl.searchParams.set("y", String(date.y));
    slotsUrl.searchParams.set("m", String(date.m).padStart(2, "0"));
    slotsUrl.searchParams.set("d", String(date.d).padStart(2, "0"));
  } else {
    slotsUrl.searchParams.set("days", "14");
  }
  slotsUrl.searchParams.set("limit", "6");
  slotsUrl.searchParams.set("page", String(page));

  // >>> Force a 60-minute lead (only effective if /api/slots honors it)
  slotsUrl.searchParams.set("lead", "60");
  slotsUrl.searchParams.set("leadMins", "60");
  slotsUrl.searchParams.set("lead_minutes", "60");

  try {
    const r = await fetch(slotsUrl.toString(), { cache: "no-store" });
    const j = await r.json().catch(() => ({} as any));
    const slots = Array.isArray(j?.slots) ? j.slots : [];

    // Do NOT filter disabled here. The UI needs them to gray out.
    return NextResponse.json({
      type: "slots",
      text: "Pick a time that works (ET):",
      date: date ?? null,
      total: slots.length,
      slots,
    });
  } catch {
    return NextResponse.json({
      type: "error",
      text: "Couldn’t load times right now. Please try again.",
    });
  }
}
