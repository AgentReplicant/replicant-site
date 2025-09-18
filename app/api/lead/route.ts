// app/api/lead/route.ts
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
    const body = await req.json().catch(() => ({}));
    const name = (body.name || body.Name || "").toString().trim();
    const email = (body.email || body.Email || "").toString().trim();
    const phone = (body.phone || body.Phone || "").toString().trim();
    const message = (body.message || body.notes || body.Message || "").toString().trim();

    if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
      return bad("Airtable is not configured on the server.", 500);
    }
    if (!email) return bad("Email is required.");

    // Optional extra fields you added; pass-through if present
    const extras: Record<string, any> = {};
    for (const k of [
      "UseCase", "ChannelsWanted", "MeetingType", "Vertical",
      "BudgetBand", "Timeline", "AIOpenness", "InterestLevel",
      "VolumeWeekly", "PersonaSeen"
    ]) {
      if (body[k] != null && body[k] !== "") extras[k] = body[k];
    }

    // --- Upsert by Email (case-insensitive) ---
    const headers = {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    };

    const findUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
      AIRTABLE_TABLE_NAME
    )}?filterByFormula=${encodeURIComponent(`LOWER({Email})="${email.toLowerCase()}"`)}&maxRecords=1`;

    const found = await fetch(findUrl, { headers, cache: "no-store" })
      .then(r => r.json())
      .catch(() => ({ records: [] as any[] }));

    const fields: Record<string, any> = {
      Name: name || "",
      Email: email,
      Phone: phone || "",
      Message: message || "",
      Source: "Replicant site",     // <- canonical Source
      Status: "New",                 // <- canonical Status
      ...extras,
    };

    if (found.records?.[0]) {
      const id = found.records[0].id as string;
      const patch = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}/${id}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ fields, typecast: true }),
        }
      ).then(r => r.json());

      return NextResponse.json({ ok: true, id: patch.id, updated: true });
    } else {
      const create = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            records: [{ fields }],
            typecast: true,
          }),
        }
      ).then(r => r.json());

      const rec = create.records?.[0];
      return NextResponse.json({ ok: true, id: rec?.id, created: true });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lead error" }, { status: 500 });
  }
}
