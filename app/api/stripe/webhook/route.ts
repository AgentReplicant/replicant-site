// app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  findLeadByEmailOrPhone,
  upsertLead,
} from "@/lib/airtable/leads";
import { sendAdminPaymentNotification } from "@/lib/email/sendgrid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe client
 * (keeping current pinned version per setup)
 */
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2025-07-30.basil",
  });
}

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
    event = getStripe().webhooks.constructEvent(rawBody, sig, whsec);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;

        const email =
          s.customer_details?.email || s.customer_email || "";
        const name = s.customer_details?.name || "";
        const phone = s.customer_details?.phone || "";
        const stripeSessionId = s.id;

        // Required for Airtable upsert (lookup key)
        if (!email) {
          console.warn("[stripe webhook] checkout.session.completed without email; skipping Airtable upsert");
          break;
        }

        // Idempotency guard: if a lead already exists with this StripePaymentId, skip the upsert.
        // Stripe retries webhooks on non-2xx responses; this avoids redundant PATCHes.
        const existing = await findLeadByEmailOrPhone({ email });
        const alreadyProcessed =
          existing?.fields?.StripePaymentId === stripeSessionId;

        if (!alreadyProcessed) {
          await upsertLead({
            email,
            name: name || undefined,
            phone: phone || undefined,
            source: "Stripe",
            status: "Won",
            stripePaymentId: stripeSessionId,
          });

          // Admin heads-up (best-effort, never fails the webhook).
          // Inside the idempotency block so Stripe retries don't duplicate admin emails.
          await sendAdminPaymentNotification({
            to: process.env.ADMIN_NOTIFY_EMAIL || "",
            customerName: name || undefined,
            customerEmail: email,
            sessionId: stripeSessionId,
          });
        } else {
          console.info("[stripe webhook] already processed, skipping upsert + admin notify", { stripeSessionId });
        }

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