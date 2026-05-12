// app/api/lead/route.ts
import { NextRequest, NextResponse } from "next/server";
import { upsertLead, normalizePhone, type LeadPayload } from "@/lib/airtable/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as LeadPayload;
    const email = (body.email || "").trim();
    const phone = normalizePhone(body.phone);

    if (!email && !phone) {
      return NextResponse.json({ ok: false, error: "email or phone required" }, { status: 400 });
    }

    const { id, mode } = await upsertLead(body);
    return NextResponse.json({ ok: true, id, mode });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lead upsert failed" }, { status: 500 });
  }
}