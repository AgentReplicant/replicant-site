// app/api/sms/webhook/route.ts
import { NextResponse } from "next/server";
import { brainProcess } from "../../../../lib/brain";
import type { BrainCtx } from "../../../../lib/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const body = form ? String(form.get("Body") || "") : "";
  const from = form ? String(form.get("From") || "") : undefined;

  const ctx: BrainCtx = {
    channel: "sms",
    tzLabel: process.env.BOOKING_TZ || "America/New_York",
    sessionId: from,
    page: 0,
    date: null,
    lead: from ? { phone: from } : undefined,
  };

  const res = await brainProcess({ message: body }, ctx);

  const text =
    res.type === "text"
      ? res.text
      : res.type === "action" && res.action === "open_url"
      ? `${res.text ? res.text + " " : ""}${res.url}`
      : res.type === "booked"
      ? `You're all set.${res.meetLink ? ` Meet: ${res.meetLink}` : ""}`
      : res.type === "slots"
      ? (res.text || "Here are some times (ET):") +
        "\n" +
        (res.slots || [])
          .filter((s: any) => !s.disabled)
          .slice(0, 6)
          .map((s: any) => `• ${s.label}`)
          .join("\n")
      : "Okay.";

  const twiml = `<Response><Message>${text}</Message></Response>`;
  return new NextResponse(twiml, { headers: { "content-type": "application/xml" } });
}
