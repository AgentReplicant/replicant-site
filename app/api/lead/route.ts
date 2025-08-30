import { NextResponse } from "next/server";

type LeadIn = {
  name: string;
  email: string;
  phone?: string;
  message?: string;
  source?: string;
  _hp?: string; // honeypot
};

const TABLE = process.env.AIRTABLE_TABLE_NAME || "Leads";

// Field-name mapping (defaults match your base; envs let you rename safely)
const F = {
  name: process.env.LEAD_FIELD_NAME || "Name",
  email: process.env.LEAD_FIELD_EMAIL || "Email",
  phone: process.env.LEAD_FIELD_PHONE || "Phone",
  notes: process.env.LEAD_FIELD_NOTES || "Message",
  source: process.env.LEAD_FIELD_SOURCE || "Source",
  status: process.env.LEAD_FIELD_STATUS || "Status",
  createdAt: process.env.LEAD_FIELD_CREATED_AT || "", // leave blank unless you really want to set a custom field
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LeadIn;

    // basic bot trap
    if (body._hp) return NextResponse.json({ ok: true, spam: true });

    // validate/normalize
    const name = (body.name || "").trim().slice(0, 120);
    const email = (body.email || "").trim().toLowerCase().slice(0, 200);
    const phone = (body.phone || "").trim().slice(0, 80);
    const message = (body.message || "").trim().slice(0, 2000);
    const source = (body.source || "Replicant site").slice(0, 120);

    if (!name || !email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    // build Airtable fields using your mapping
    const fields: Record<string, any> = {
      [F.name]: name,
      [F.email]: email,
      [F.source]: source,
      [F.status]: "New",
    };
    if (phone) fields[F.phone] = phone;
    if (message) fields[F.notes] = message;
    if (F.createdAt) fields[F.createdAt] = new Date().toISOString(); // only if you mapped a custom field

    const url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(
      TABLE
    )}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation", // helpful for debugging
      },
      body: JSON.stringify({ records: [{ fields }] }),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Airtable error:", res.status, text);
      return NextResponse.json({ ok: false, error: "airtable_write_failed" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Lead handler crash:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
