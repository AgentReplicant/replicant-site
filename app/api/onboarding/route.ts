// app/api/onboarding/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  findLeadByEmailOrPhone,
  upsertLead,
  type LeadPayload,
} from "@/lib/airtable/leads";

type OnboardingPayload = {
  email?: string;
  name?: string;
  business?: string;
  website?: string;
  phone?: string;
  notes?: string;
  useCase?: string;            // accepted but no longer written (Phase 3A schema removed)
  channels?: string[];         // accepted but no longer written
  meetingType?: string;        // accepted but no longer written
  stripeSessionId?: string;
};

/**
 * Map the legacy onboarding payload shape onto the canonical LeadPayload.
 * Drops fields removed in Phase 3A (UseCase, ChannelsWanted, MeetingType, OnboardingJSON).
 */
function toLeadPayload(p: OnboardingPayload): LeadPayload {
  return {
    name: p.name || p.business || "",
    businessName: p.business,
    email: p.email,
    phone: p.phone,
    currentWebsiteUrl: p.website,
    message: p.notes,
    source: "Onboarding",
    status: "New Lead",
    stripePaymentId: p.stripeSessionId,
  };
}

// GET /api/onboarding?email=...
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const email = (url.searchParams.get("email") || "").trim();
    if (!email) {
      return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
    }
    const rec = await findLeadByEmailOrPhone({ email });
    if (!rec) return NextResponse.json({ ok: true, found: false });

    return NextResponse.json({
      ok: true,
      found: true,
      airtableId: rec.id,
      fields: rec.fields || {},
    });
  } catch (e: any) {
    console.error("[onboarding][GET] error:", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}

// POST /api/onboarding
export async function POST(req: NextRequest) {
  try {
    const data = (await req.json().catch(() => ({}))) as OnboardingPayload;
    const email = (data.email || "").trim();
    if (!email) {
      return NextResponse.json({ ok: false, error: "email is required" }, { status: 400 });
    }

    const { id, mode } = await upsertLead(toLeadPayload(data));
    console.info("[onboarding]", mode, { id, email });

    return NextResponse.json({ ok: true, mode, airtableId: id });
  } catch (e: any) {
    console.error("[onboarding][POST] error:", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}