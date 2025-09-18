// app/api/onboarding/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || "Leads";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: NextRequest) {
  try {
    if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
      return bad("Airtable is not configured.", 500);
    }

    const body = await req.json().catch(() => ({}));
    const email = (body.email || "").toString().trim().toLowerCase();
    const stripeSessionId = (body.stripeSessionId || "").toString().trim();

    if (!email && !stripeSessionId) {
      return bad("Provide at least email or stripeSessionId.");
    }

    // Prepare fields we may map directly to picklists later
    const mapped: Record<string, any> = {};

    if (body.useCase) mapped.UseCase = body.useCase; // e.g., Sales | Booking | Support | Mixed
    if (Array.isArray(body.channels)) mapped.ChannelsWanted = body.channels; // multi-select
    if (body.meetingType) mapped.MeetingType = body.meetingType; // Google Meet | Phone call

    // Always store the full payload for reference
    mapped.OnboardingJSON = JSON.stringify(body);

    // Canonical Source/Status for onboarding
    mapped.Source = "Onboarding";
    mapped.Status = "OnboardingPending";

    // Also store handy basics if provided
    if (body.business) mapped.Name = body.business;
    if (body.website) mapped.Website = body.website;
    if (email) mapped.Email = email;
    if (body.notes) mapped.Message = body.notes;

    const headers = {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    };

    // Find existing lead by email or by StripePaymentId
    let recordId: string | null = null;

    if (email) {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
        AIRTABLE_TABLE_NAME
      )}?filterByFormula=${encodeURIComponent(`LOWER({Email})="${email}"`)}&maxRecords=1`;
      const found = await fetch(url, { headers, cache: "no-store" }).then((r) => r.json());
      if (found.records?.[0]?.id) recordId = found.records[0].id;
    }

    if (!recordId && stripeSessionId) {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
        AIRTABLE_TABLE_NAME
      )}?filterByFormula=${encodeURIComponent(`{StripePaymentId}="${stripeSessionId}"`)}&maxRecords=1`;
      const found = await fetch(url, { headers, cache: "no-store" }).then((r) => r.json());
      if (found.records?.[0]?.id) recordId = found.records[0].id;
    }

    if (recordId) {
      // Update
      const patch = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}/${recordId}`,
        { method: "PATCH", headers, body: JSON.stringify({ fields: mapped, typecast: true }) }
      ).then((r) => r.json());

      return NextResponse.json({ ok: true, id: patch.id, updated: true });
    } else {
      // Create new
      const create = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ records: [{ fields: mapped }], typecast: true }),
        }
      ).then((r) => r.json());

      const rec = create.records?.[0];
      return NextResponse.json({ ok: true, id: rec?.id, created: true });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Onboarding error" }, { status: 500 });
  }
}
