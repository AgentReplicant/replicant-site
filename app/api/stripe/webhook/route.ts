// app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe client
 * (keeping your current pinned version per your setup)
 */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-07-30.basil",
});

/** Health checks */
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "stripe/webhook" });
}
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !whsec) {
    return NextResponse.json(
      { ok: false, error: "Missing signature or STRIPE_WEBHOOK_SECRET" },
      { status: 400 }
    );
  }

  // IMPORTANT: use the raw body for verification
  const rawBody = Buffer.from(await req.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whsec);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;

        const email =
          s.customer_details?.email || s.customer_email || "" /* required to upsert */;
        const name = s.customer_details?.name || "";
        const stripeSessionId = s.id;

        await upsertLeadPaid({
          email,
          name,
          stripeSessionId,
        });

        // Optional admin heads-up
        await maybeSendEmail({
          to: process.env.ADMIN_NOTIFY_EMAIL,
          subject: "Replicant — New Payment",
          text: `New payment from ${name || email}\nSession: ${stripeSessionId}`,
        });

        break;
      }

      default:
        // no-op for other events
        break;
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("Webhook handling error:", e);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

/* ------------------------------ Airtable I/O ------------------------------ */

async function upsertLeadPaid({
  email,
  name,
  stripeSessionId,
}: {
  email?: string;
  name?: string;
  stripeSessionId?: string;
}) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || "Leads";

  if (!token || !baseId || !email) return;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Find by email (case-insensitive)
  const findUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
    table
  )}?filterByFormula=${encodeURIComponent(
    `LOWER({Email})="${email.toLowerCase()}"`
  )}&maxRecords=1`;

  const list = await fetch(findUrl, { headers, cache: "no-store" }).then((r) =>
    r.json()
  );

  if (list.records?.[0]) {
    // Idempotency guard: skip if this session already processed
    if (list.records[0].fields?.StripePaymentId === stripeSessionId) return;

    // PATCH existing
    await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}/${list.records[0].id}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          fields: {
            Status: "Paid",
            StripePaymentId: stripeSessionId || "",
            Source: "Stripe", // <- normalized title-case
          },
          typecast: true,
        }),
      }
    );
  } else {
    // CREATE new
    await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          records: [
            {
              fields: {
                Name: name || "",
                Email: email,
                Status: "Paid",
                StripePaymentId: stripeSessionId || "",
                Source: "Stripe", // <- normalized title-case
              },
            },
          ],
          typecast: true,
        }),
      }
    );
  }
}

/* ------------------------------ SendGrid notify ------------------------------ */

async function maybeSendEmail({
  to,
  subject,
  text,
}: {
  to?: string | null;
  subject: string;
  text: string;
}) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key || !to) return;

  try {
    await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: "agentreplicant@gmail.com", name: "Replicant" },
        subject,
        content: [{ type: "text/plain", value: text }],
      }),
    });
  } catch (e) {
    console.warn("SendGrid notify skipped/error:", e);
  }
}
