// app/api/slots/route.ts
import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/calendar/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const y = Number(url.searchParams.get("y"));
    const m = Number(url.searchParams.get("m"));
    const d = Number(url.searchParams.get("d"));
    const date = y && m && d ? { y, m, d } : null;
    const limit = Number(url.searchParams.get("limit") || 8);
    const days = Number(url.searchParams.get("days") || (date ? 1 : 7));
    const page = parseInt(url.searchParams.get("page") || "0", 10);

    const slots = await getAvailableSlots({ date, days, limit, page });

    console.log("[slots] returned", { page, limit, returned: slots.length });

    return NextResponse.json({ ok: true, slots });
  } catch (err: any) {
    const msg = err?.message || "Unable to generate slots";
    console.error("[slots] error", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}