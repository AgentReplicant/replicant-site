// app/api/schedule/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { bookAndConfirmPhoneCall } from "@/lib/booking/phoneCall";
import { CalendarError } from "@/lib/calendar/google";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      start?: string;
      end?: string;
      email?: string;
      phone?: string;
      name?: string;
      notes?: string;
    };

    const result = await bookAndConfirmPhoneCall({
      start: body.start || "",
      end: body.end || "",
      email: body.email || "",
      phone: body.phone || "",
      name: body.name,
      notes: body.notes,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    if (err instanceof CalendarError) {
      const status =
        err.code === "BAD_REQUEST" ? 400 :
        err.code === "LEAD_WINDOW" ? 409 :
        err.code === "SLOT_TAKEN" ? 409 :
        err.code === "CONFIG" ? 500 : 500;
      console.error("[schedule] error", err.code, err.message);
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    const g = err?.response?.data;
    const message =
      g?.error?.message || g?.error_description || err?.message || "Unknown scheduling error";
    console.error("[schedule] error", message);
    return NextResponse.json({ error: message, google: g || null }, { status: 500 });
  }
}