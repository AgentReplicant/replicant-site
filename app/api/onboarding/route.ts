// app/api/onboarding/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const token = process.env.AIRTABLE_TOKEN || "";
const baseId = process.env.AIRTABLE_BASE_ID || "";
const table = process.env.AIRTABLE_TABLE_NAME || "Leads";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body?.email || "").trim();
    if (!token || !baseId || !email) {
      return NextResponse.json({ ok: false, error: "missing Airtable envs or email" }, { status: 400 });
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // find existing lead by email
    const list = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?filterByFormula=${
        encodeURIComponent(`LOWER({Email})="${email.toLowerCase()}"`)
      }&maxRecords=1`,
      { headers, cache: "no-store" }
    ).then((r) => r.json());

    const onboarding = {
      businessName: body.businessName || "",
      website: body.website || "",
      phone: body.phone || "",
      agents: {
        support: !!body.agentSupport,
        booking: !!body.agentBooking,
        sales: !!body.agentSales,
      },
      channels: {
        web: !!body.chanWeb,
        instagram: !!body.chanInstagram,
        instagramHandle: body.instagramHandle || "",
        whatsapp: !!body.chanWhatsApp,
        whatsAppNumber: body.whatsAppNumber || "",
        sms: !!body.chanSMS,
        smsNumber: body.smsNumber || "",
      },
      booking: {
        meetingType: body.meetingType || "video",
        hoursNotes: body.hoursNotes || "",
      },
      knowledge: {
        faqsUrl: body.faqsUrl || "",
        faqsText: body.faqsText || "",
      },
      notes: body.notes || "",
    };

    const fields: Record<string, any> = {
      Email: email,
      Name: body.businessName || email,
      Source: "onboarding",
      Status: "OnboardingPending",
      OnboardingJSON: JSON.stringify(onboarding, null, 2),
    };

    if (list.records?.[0]) {
      const id = list.records[0].id;
      await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${id}`, {
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
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}
