import { NextResponse } from "next/server";

// Required env
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE_NAME || "Leads";

// Optional env
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const ADMIN_EMAIL =
  process.env.ADMIN_NOTIFY_EMAIL || "agentreplicant@gmail.com";

// Field mapping envs (so we don't force specific column names)
const FIELDS = {
  NAME: (process.env.LEAD_FIELD_NAME || "Name").trim(),
  EMAIL: (process.env.LEAD_FIELD_EMAIL || "Email").trim(),
  NOTES: (process.env.LEAD_FIELD_NOTES || "Notes").trim(), // <- maps to your "Message"
  SOURCE: (process.env.LEAD_FIELD_SOURCE || "Source").trim(),
  PHONE: (process.env.LEAD_FIELD_PHONE || "").trim(), // optional
  STATUS: (process.env.LEAD_FIELD_STATUS || "").trim(), // optional
  CREATED_AT: (process.env.LEAD_FIELD_CREATED_AT || "").trim(), // optional; leave empty if you use Airtable's "Created time"
};
const DEFAULT_STATUS = (process.env.LEAD_DEFAULT_STATUS || "").trim();

function requireEnv(v?: string, name?: string) {
  if (!v) throw new Error(`Missing required env ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    // Basic validation
    const body = await req.json().catch(() => ({}));
    const name = (body?.name || "").toString();
    const email = (body?.email || "").toString();
    const notes = (body?.notes || "").toString();
    const phone = (body?.phone || "").toString();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Build Airtable fields using your mapping
    const fields: Record<string, any> = {
      [FIELDS.NAME]: name,
      [FIELDS.EMAIL]: email,
      [FIELDS.NOTES]: notes,
      [FIELDS.SOURCE]: "Replicant site",
    };

    if (FIELDS.PHONE) fields[FIELDS.PHONE] = phone;
    if (FIELDS.STATUS && DEFAULT_STATUS) fields[FIELDS.STATUS] = DEFAULT_STATUS;
    // Only set CREATED_AT if you mapped it to a normal (non "Created time") column
    if (FIELDS.CREATED_AT) fields[FIELDS.CREATED_AT] = new Date().toISOString();

    // 1) Write to Airtable
    requireEnv(AIRTABLE_TOKEN, "AIRTABLE_TOKEN");
    requireEnv(AIRTABLE_BASE_ID, "AIRTABLE_BASE_ID");

    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
        AIRTABLE_TABLE
      )}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: [{ fields }],
        }),
      }
    );

    if (!airtableRes.ok) {
      const text = await airtableRes.text();
      // This log shows up in Vercel -> Deployment -> Logs
      console.error("Airtable error:", text);
      return NextResponse.json(
        { error: "Airtable write failed" },
        { status: 502 }
      );
    }

    // 2) Optional email (SendGrid)
    if (SENDGRID_API_KEY) {
      const content = `New lead
Name: ${name || "-"}
Email: ${email}
Phone: ${phone || "-"}
Notes: ${notes || "-"}`;

      await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: ADMIN_EMAIL }] }],
          from: { email: "no-reply@replicant.site", name: "Replicant Bot" },
          subject: "New Replicant lead",
          content: [{ type: "text/plain", value: content }],
        }),
      }).catch(() => {
        // don't fail the request if email fails
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Lead route error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
