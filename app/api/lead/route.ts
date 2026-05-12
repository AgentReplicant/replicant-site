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

/**
 * Accepted lead payload. All fields optional except (email OR phone).
 *
 * Field mapping to Airtable columns (Phase 3A schema):
 *   name             -> Name
 *   businessName     -> Business Name
 *   email            -> Email
 *   phone            -> Phone
 *   businessCategory -> Business Category (single-select)
 *   currentWebsiteUrl-> Current Website URL
 *   socialLink       -> Social Link
 *   bookingPlatform  -> Booking Platform (single-select)
 *   mainGoal         -> Main Goal (single-select)
 *   mainProblem      -> Main Problem
 *   budgetRange      -> Budget Range (single-select)
 *   desiredTimeline  -> Desired Timeline (single-select)
 *   interestType     -> Interest Type (single-select)
 *   recommendedPackage -> Recommended Package (single-select)
 *   message          -> Message
 *   source           -> Source (single-select)
 *   status           -> Status (single-select, defaults to "New Lead")
 */
type LeadPayload = {
  name?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  businessCategory?: string;
  currentWebsiteUrl?: string;
  socialLink?: string;
  bookingPlatform?: string;
  mainGoal?: string;
  mainProblem?: string;
  budgetRange?: string;
  desiredTimeline?: string;
  interestType?: string;
  recommendedPackage?: string;
  message?: string;
  source?: string;
  status?: string;
};

/**
 * Build an Airtable fields object, only including keys with truthy values.
 * Prevents accidentally wiping populated fields on upsert PATCH.
 */
function buildFields(body: LeadPayload): Record<string, any> {
  const fields: Record<string, any> = {};
  if (body.name) fields["Name"] = body.name.trim();
  if (body.businessName) fields["Business Name"] = body.businessName.trim();
  if (body.email) fields["Email"] = body.email.trim();
  if (body.phone) fields["Phone"] = normPhone(body.phone);
  if (body.businessCategory) fields["Business Category"] = body.businessCategory;
  if (body.currentWebsiteUrl) fields["Current Website URL"] = body.currentWebsiteUrl.trim();
  if (body.socialLink) fields["Social Link"] = body.socialLink.trim();
  if (body.bookingPlatform) fields["Booking Platform"] = body.bookingPlatform;
  if (body.mainGoal) fields["Main Goal"] = body.mainGoal;
  if (body.mainProblem) fields["Main Problem"] = body.mainProblem.trim();
  if (body.budgetRange) fields["Budget Range"] = body.budgetRange;
  if (body.desiredTimeline) fields["Desired Timeline"] = body.desiredTimeline;
  if (body.interestType) fields["Interest Type"] = body.interestType;
  if (body.recommendedPackage) fields["Recommended Package"] = body.recommendedPackage;
  if (body.message) fields["Message"] = body.message.trim();
  if (body.source) fields["Source"] = body.source;
  // Always set a Status on first write; on update, preserve existing if caller didn't pass one.
  if (body.status) fields["Status"] = body.status;
  return fields;
}

export async function POST(req: NextRequest) {
  try {
    if (!token || !baseId) {
      return NextResponse.json({ ok: false, error: "Airtable not configured" }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as LeadPayload;
    const email = (body.email || "").trim();
    const phone = normPhone(body.phone);

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

    const fields = buildFields(body);

    let id: string | undefined = list.records?.[0]?.id;
    if (id) {
      // Update existing — never overwrite a populated field with blank.
      // (buildFields already omits blanks, so PATCH is safe.)
      await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${id}`, {
        method: "PATCH",
        headers: hdr(),
        body: JSON.stringify({ fields, typecast: true }),
      });
    } else {
      // Create new — default Status to "New Lead" if caller didn't specify.
      if (!fields["Status"]) fields["Status"] = "New Lead";
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