// app/api/onboarding/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

/**
 * ENV needed:
 *  - AIRTABLE_TOKEN
 *  - AIRTABLE_BASE_ID
 *  - (optional) AIRTABLE_TABLE_NAME  // default: "Leads"
 */
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE_NAME || "Leads";

function requireEnv(name: string, val?: string) {
  if (!val) throw new Error(`Missing env: ${name}`);
}

function headers() {
  return {
    Authorization: `Bearer ${AIRTABLE_TOKEN}`,
    "Content-Type": "application/json",
  };
}

type UpsertPayload = {
  email?: string;
  name?: string;
  business?: string;
  website?: string;
  phone?: string;
  notes?: string;
  useCase?: string;            // e.g., "Sales" | "Support" | "Booking" | "Other"
  channels?: string[];         // e.g., ["Web","Instagram"]
  meetingType?: string;        // e.g., "Google Meet" | "Phone"
  stripeSessionId?: string;    // optional
};

async function findLeadByEmail(email: string) {
  const formula = encodeURIComponent(`LOWER({Email})="${email.toLowerCase()}"`);
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    AIRTABLE_TABLE
  )}?filterByFormula=${formula}&maxRecords=1`;
  const r = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Airtable list failed (${r.status}): ${t}`);
  }
  const j = (await r.json()) as { records?: any[] };
  return j.records?.[0] ?? null;
}

async function createLead(fields: any) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`;
  const body = JSON.stringify({ records: [{ fields }], typecast: true });
  const r = await fetch(url, { method: "POST", headers: headers(), body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Airtable create failed (${r.status}): ${JSON.stringify(j)}`);
  return j.records?.[0];
}

async function updateLead(id: string, fields: any) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}/${id}`;
  const body = JSON.stringify({ fields, typecast: true });
  const r = await fetch(url, { method: "PATCH", headers: headers(), body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Airtable update failed (${r.status}): ${JSON.stringify(j)}`);
  return j;
}

function buildFieldsFromPayload(p: UpsertPayload) {
  // What we always set for onboarding intake
  const base: any = {
    Source: "Onboarding",
    Status: "OnboardingPending",
    Email: p.email || "",
    Name: p.name || p.business || "",
    Message: p.notes || "",
    Website: p.website || "",
    Phone: p.phone || "",
    OnboardingJSON: JSON.stringify(p),
  };

  // Optional fields if present (make sure column names exist)
  if (p.useCase) base.UseCase = p.useCase;                      // single select or text
  if (p.meetingType) base.MeetingType = p.meetingType;          // single select or text
  if (Array.isArray(p.channels)) base.ChannelsWanted = p.channels; // multi select

  if (p.stripeSessionId) base.StripePaymentId = p.stripeSessionId; // optional surface

  return base;
}

// GET /api/onboarding?email=...
export async function GET(req: NextRequest) {
  try {
    requireEnv("AIRTABLE_TOKEN", AIRTABLE_TOKEN);
    requireEnv("AIRTABLE_BASE_ID", AIRTABLE_BASE_ID);

    const url = new URL(req.url);
    const email = (url.searchParams.get("email") || "").trim();
    if (!email) {
      return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
    }
    const rec = await findLeadByEmail(email);
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
    requireEnv("AIRTABLE_TOKEN", AIRTABLE_TOKEN);
    requireEnv("AIRTABLE_BASE_ID", AIRTABLE_BASE_ID);

    const data = (await req.json().catch(() => ({}))) as UpsertPayload;
    const email = (data.email || "").trim();
    if (!email) {
      return NextResponse.json({ ok: false, error: "email is required" }, { status: 400 });
    }

    const fields = buildFieldsFromPayload(data);

    // Upsert by Email
    const existing = await findLeadByEmail(email);

    if (existing) {
      const res = await updateLead(existing.id, fields);
      console.info("[onboarding] updated", { id: existing.id, email, Source: fields.Source, Status: fields.Status });
      return NextResponse.json({
        ok: true,
        mode: "updated",
        airtableId: existing.id,
        fields: res?.fields || fields,
      });
    } else {
      const rec = await createLead(fields);
      console.info("[onboarding] created", { id: rec.id, email, Source: fields.Source, Status: fields.Status });
      return NextResponse.json({
        ok: true,
        mode: "created",
        airtableId: rec.id,
        fields: rec.fields || fields,
      });
    }
  } catch (e: any) {
    console.error("[onboarding][POST] error:", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}
