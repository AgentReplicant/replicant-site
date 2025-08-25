import { NextResponse } from "next/server";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE_NAME || "Leads";
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "agentreplicant@gmail.com";

export async function POST(req: Request) {
  try {
    const { name, email, notes } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // 1) Write to Airtable
    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: [
            {
              fields: {
                Name: name || "",
                Email: email,
                Notes: notes || "",
                Source: "Replicant site",
                CreatedAt: new Date().toISOString(),
              },
            },
          ],
        }),
      }
    );

    if (!airtableRes.ok) {
      const text = await airtableRes.text();
      console.error("Airtable error:", text);
      return NextResponse.json({ error: "Airtable write failed" }, { status: 502 });
    }

    // 2) Email notify (optional)
    if (SENDGRID_API_KEY) {
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
          content: [
            {
              type: "text/plain",
              value: `New lead\nName: ${name || ""}\nEmail: ${email}\nNotes: ${notes || ""}`,
            },
          ],
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as Error;
    console.error("Lead route error:", err.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
