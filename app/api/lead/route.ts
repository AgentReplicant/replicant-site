import { NextResponse } from "next/server";

type Lead = { name: string; email: string; phone?: string; message?: string; source?: string; _hp?: string };
const TABLE = process.env.AIRTABLE_TABLE_NAME || "Leads";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Lead;

    if (body._hp) return NextResponse.json({ ok: true, spam: true }); // honeypot

    const name = (body.name || "").trim().slice(0, 120);
    const email = (body.email || "").trim().toLowerCase().slice(0, 200);
    const phone = (body.phone || "").trim().slice(0, 80);
    const message = (body.message || "").trim().slice(0, 2000);
    const source = (body.source || "Replicant site").slice(0, 120);

    if (!name || !email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: [
          {
            fields: {
              Name: name,
              Email: email,
              Phone: phone || undefined,
              Message: message || undefined,
              Source: source,
              Status: "New",
              "Created Time": new Date().toISOString(),
            },
          },
        ],
      }),
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
