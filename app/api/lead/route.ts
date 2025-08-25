import { NextResponse } from "next/server";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "";
const SOURCE_LABEL = "Replicant site"; // must exist in Airtable's "Source" single-select options

type LeadPayload = {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function isPhone(v?: string) {
  if (!v) return true;
  const cleaned = v.replace(/[^\d+().\-\s]/g, "");
  return cleaned.length >= 7 && cleaned.length <= 20;
}

export async function POST(req: Request) {
  try {
    const body: LeadPayload = await req.json();

    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const phone = (body.phone || "").trim();
    const notes = (body.notes || "").trim();

    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    if (!isEmail(email)) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    if (!isPhone(phone)) return NextResponse.json({ error: "Invalid phone" }, { status: 400 });

    // Build Airtable fields – field names MUST match your table
    // Expected columns: Name (text), Email (email), Phone (phone), Message (long text), Source (single select)
    const airtableFields: Record<string, any> = {
      Name: name,
      Email: email,
      Message: notes,
      Source: SOURCE_LABEL,
    };

    if (phone) airtableFields["Phone"] = phone;

    const createRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Leads`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: [{ fields: airtableFields }],
          typecast: true, // allows single-select to accept existing option labels
        }),
        cache: "no-store",
      }
    );

    const createJson = await createRes.json();

    if (!createRes.ok) {
      console.error("Airtable error:", createJson);
      return NextResponse.json(
        { error: "Airtable create failed", detail: createJson },
        { status: 502 }
      );
    }

    // Optional email notification via SendGrid
    if (SENDGRID_API_KEY && ADMIN_EMAIL) {
      try {
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
                value:
                  `New lead\n\n` +
                  `Name: ${name}\n` +
                  `Email: ${email}\n` +
                  (phone ? `Phone: ${phone}\n` : ``) +
                  `Notes: ${notes || "(none)"}`,
              },
            ],
          }),
        });
      } catch (e) {
        // Non-fatal
        console.warn("SendGrid error:", (e as Error).message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Lead route error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
