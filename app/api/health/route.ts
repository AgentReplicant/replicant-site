import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const required = ["AIRTABLE_TOKEN", "AIRTABLE_BASE_ID", "STRIPE_WEBHOOK_SECRET"];
const tbl = process.env.AIRTABLE_TABLE_NAME || "Leads";

export async function GET(req: Request) {
  const key = req.headers.get("x-admin-key");
  if (!key || key !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const env = Object.fromEntries(required.map(k => [k, !!process.env[k as any]]));

  let airtable = { ok: false, status: 0 };
  try {
    const url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(tbl)}?pageSize=1`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` },
      cache: "no-store",
    });
    airtable = { ok: r.ok, status: r.status };
  } catch {}

  const stripe = { webhookSecretPresent: !!process.env.STRIPE_WEBHOOK_SECRET };

  return NextResponse.json({
    ok: env.AIRTABLE_TOKEN && env.AIRTABLE_BASE_ID && stripe.webhookSecretPresent && airtable.ok,
    env, airtable, stripe, table: tbl,
  });
}
