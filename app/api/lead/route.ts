// app/api/lead/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const token = process.env.AIRTABLE_TOKEN || "";
const baseId = process.env.AIRTABLE_BASE_ID || "";
const table = process.env.AIRTABLE_TABLE_NAME || "Leads";

function hdr() {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}
function normPhone(p?: string) {
  return (p || "").replace(/[^\d]/g, "");
}

export async function POST(req: NextRequest) {
  try {
    if (!token || !baseId) {
      return NextResponse.json({ ok: false, error: "Airtable not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({} as any));
    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const phone = normPhone(body.phone);
    const message = (body.message || "").trim();
    const source = body.source || "Replicant site";
    const status = body.status || "Engaged"; // pipeline stage for first-PII

    if (!email && !phone) {
      return NextResponse.json({ ok: false, error: "email or phone required" }, { status: 400 });
    }

    const idFormula = email
      ? `LOWER({Email})="${email.toLowerCase()}"`
      : `{Phone}="${phone}"`;

    const list = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
        table
      )}?filterByFormula=${encodeURIComponent(idFormula)}&maxRecords=1`,
      { headers: hdr(), cache: "no-store" }
    ).then((r) => r.json());

    const fields: any = {};
    if (name) fields["Name"] = name;
    if (email) fields["Email"] = email;
    if (phone) fields["Phone"] = phone;
    if (message) fields["Message"] = message;
    fields["Source"] = source;
    fields["Status"] = status;

    let id: string | undefined = list.records?.[0]?.id;
    if (id) {
      await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${id}`, {
        method: "PATCH",
        headers: hdr(),
        body: JSON.stringify({ fields, typecast: true }),
      });
    } else {
      const created = await fetch(
        `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`,
        {
          method: "POST",
          headers: hdr(),
          body: JSON.stringify({ records: [{ fields }], typecast: true }),
        }
      ).then((r) => r.json());
      id = created.records?.[0]?.id;
    }

    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lead upsert failed" }, { status: 500 });
  }
}
