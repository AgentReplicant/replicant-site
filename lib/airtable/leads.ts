// lib/airtable/leads.ts
//
// Shared Airtable lead adapter.
// Single source of truth for upsert/find/create/update against the Leads table.
//
// Behavior rules (preserve byte-for-byte from Phase 3A inline logic):
//   - Look up existing row by email (preferred) or phone.
//   - On update, never overwrite a populated field with a blank.
//   - On create, default Status to "New Lead" if not provided.
//   - Always send typecast: true for single-select compatibility.
//   - Normalize phone to digits-only before write and lookup.

const TOKEN = process.env.AIRTABLE_TOKEN || "";
const BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const TABLE = process.env.AIRTABLE_TABLE_NAME || "Leads";

function headers() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };
}

export function normalizePhone(p?: string): string {
  return (p || "").replace(/[^\d]/g, "");
}

/**
 * Canonical lead payload. Every caller (API routes, future channels) speaks this shape.
 * All fields optional except (email OR phone) — enforced at the route level, not here.
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
 *   status           -> Status (single-select, defaults to "New Lead" on create)
 *   stripePaymentId  -> StripePaymentId (string, used by Stripe webhook)
 */
export type LeadPayload = {
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
  stripePaymentId?: string;
};

export type AirtableLeadRecord = {
  id: string;
  createdTime: string;
  fields: Record<string, any>;
};

/**
 * Build an Airtable fields object, only including keys with truthy values.
 * Prevents accidentally wiping populated fields on upsert PATCH.
 */
function buildFields(payload: LeadPayload): Record<string, any> {
  const f: Record<string, any> = {};
  if (payload.name) f["Name"] = payload.name.trim();
  if (payload.businessName) f["Business Name"] = payload.businessName.trim();
  if (payload.email) f["Email"] = payload.email.trim();
  if (payload.phone) f["Phone"] = normalizePhone(payload.phone);
  if (payload.businessCategory) f["Business Category"] = payload.businessCategory;
  if (payload.currentWebsiteUrl) f["Current Website URL"] = payload.currentWebsiteUrl.trim();
  if (payload.socialLink) f["Social Link"] = payload.socialLink.trim();
  if (payload.bookingPlatform) f["Booking Platform"] = payload.bookingPlatform;
  if (payload.mainGoal) f["Main Goal"] = payload.mainGoal;
  if (payload.mainProblem) f["Main Problem"] = payload.mainProblem.trim();
  if (payload.budgetRange) f["Budget Range"] = payload.budgetRange;
  if (payload.desiredTimeline) f["Desired Timeline"] = payload.desiredTimeline;
  if (payload.interestType) f["Interest Type"] = payload.interestType;
  if (payload.recommendedPackage) f["Recommended Package"] = payload.recommendedPackage;
  if (payload.message) f["Message"] = payload.message.trim();
  if (payload.source) f["Source"] = payload.source;
  if (payload.status) f["Status"] = payload.status;
  if (payload.stripePaymentId) f["StripePaymentId"] = payload.stripePaymentId;
  return f;
}

function requireConfig() {
  if (!TOKEN || !BASE_ID) {
    throw new Error("Airtable not configured (missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID)");
  }
}

/**
 * Find an existing lead by email (preferred) or phone.
 * Returns null if no match.
 */
export async function findLeadByEmailOrPhone(args: {
  email?: string;
  phone?: string;
}): Promise<AirtableLeadRecord | null> {
  requireConfig();
  const email = (args.email || "").trim();
  const phone = normalizePhone(args.phone);
  if (!email && !phone) return null;

  const formula = email
    ? `LOWER({Email})="${email.toLowerCase()}"`
    : `{Phone}="${phone}"`;

  const url =
    `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}` +
    `?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;

  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Airtable find failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as { records?: AirtableLeadRecord[] };
  return json.records?.[0] ?? null;
}

/**
 * Create a new lead. Defaults Status to "New Lead" if caller didn't specify.
 * Returns the new record id.
 */
export async function createLead(payload: LeadPayload): Promise<string> {
  requireConfig();
  const fields = buildFields(payload);
  if (!fields["Status"]) fields["Status"] = "New Lead";

  const res = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ records: [{ fields }], typecast: true }),
    }
  );
  if (!res.ok) {
    throw new Error(`Airtable create failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as { records?: { id: string }[] };
  const id = json.records?.[0]?.id;
  if (!id) throw new Error("Airtable create returned no id");
  return id;
}

/**
 * Update an existing lead by id. Only writes fields with truthy values
 * (never overwrites populated data with blanks).
 */
export async function updateLead(id: string, payload: LeadPayload): Promise<void> {
  requireConfig();
  const fields = buildFields(payload);
  if (Object.keys(fields).length === 0) return; // nothing to do

  const res = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}/${id}`,
    {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ fields, typecast: true }),
    }
  );
  if (!res.ok) {
    throw new Error(`Airtable update failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
}

/**
 * Find-by-(email|phone) then update or create. Single entry point for all lead writes.
 */
export async function upsertLead(payload: LeadPayload): Promise<{ id: string; mode: "created" | "updated" }> {
  const existing = await findLeadByEmailOrPhone({ email: payload.email, phone: payload.phone });
  if (existing) {
    await updateLead(existing.id, payload);
    return { id: existing.id, mode: "updated" };
  }
  const id = await createLead(payload);
  return { id, mode: "created" };
}