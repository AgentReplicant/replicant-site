// app/api/lead/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || "Leads";
  if (!token || !baseId) return NextResponse.json({ ok: false, error: "Airtable not configured" }, { status: 400 });

  const payload = await req.json().catch(() => ({} as any));
  const email = (payload?.email || "").trim();
  if (!email) return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fields: Record<string, any> = {
    Email: email,
    ...(payload.name ? { Name: payload.name } : {}),
    ...(payload.phone ? { Phone: payload.phone } : {}),
    ...(payload.message ? { Message: payload.message } : {}),
    ...(payload.source ? { Source: payload.source } : {}),
    ...(payload.status ? { Status: payload.status } : {}),
    ...(payload.appointmentIso ? { "Appointment Time": payload.appointmentIso } : {}),
  };

  try {
    const list = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?filterByFormula=${encodeURIComponent(
        `LOWER({Email})="${email.toLowerCase()}"`
      )}&maxRecords=1`,
      { headers, cache: "no-store" }
    ).then((r) => r.json());

    if (list.records?.[0]) {
      await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${list.records[0].id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ fields, typecast: true }),
      });
    } else {
      await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ records: [{ fields }], typecast: true }),
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "airtable error" }, { status: 500 });
  }
}
