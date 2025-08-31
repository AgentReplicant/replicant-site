import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // Keep your current version
  apiVersion: '2025-07-30.basil',
});

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'stripe/webhook' });
}
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whsec) {
    return NextResponse.json({ ok: false, error: 'Missing signature or secret' }, { status: 400 });
  }

  // IMPORTANT: raw body for signature verification
  const rawBody = Buffer.from(await req.arrayBuffer());
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whsec);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object as Stripe.Checkout.Session;
      const email = s.customer_details?.email || s.customer_email || '';
      const name = s.customer_details?.name || '';
      const stripeSessionId = s.id;

      await maybeUpdateAirtable({ email, name, stripeSessionId });

      // Optional admin heads-up (auto-skips if SENDGRID_API_KEY not set)
      await maybeSendEmail({
        to: process.env.ADMIN_NOTIFY_EMAIL,
        subject: 'Replicant — New Payment',
        text: `New payment from ${name || email}\nSession: ${stripeSessionId}`,
      });
    }
    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error('Webhook handling error:', e);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

async function maybeUpdateAirtable({
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
  if (!token || !baseId || !email) return;

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    // Safer email match: lowercase + double quotes
    const list = await fetch(
      `https://api.airtable.com/v0/${baseId}/Leads?filterByFormula=${
        encodeURIComponent(`LOWER({Email})="${email.toLowerCase()}"`)
      }&maxRecords=1`,
      { headers, cache: 'no-store' }
    ).then((r) => r.json());

    if (list.records?.[0]) {
      // Idempotency guard: skip if this session already processed
      if (list.records[0].fields?.StripePaymentId === stripeSessionId) return;

      await fetch(`https://api.airtable.com/v0/${baseId}/Leads/${list.records[0].id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          fields: {
            Status: 'Paid',
            StripePaymentId: stripeSessionId || '',
            Source: 'stripe',
          },
          typecast: true, // handle single-selects etc.
        }),
      });
    } else {
      await fetch(`https://api.airtable.com/v0/${baseId}/Leads`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          records: [
            {
              fields: {
                Name: name || '',
                Email: email,
                Status: 'Paid',
                StripePaymentId: stripeSessionId || '',
                Source: 'stripe',
              },
            },
          ],
          typecast: true, // handle single-selects etc.
        }),
      });
    }
  } catch (e) {
    console.warn('Airtable upsert skipped/error:', e);
  }
}

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
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'agentreplicant@gmail.com', name: 'Replicant' },
        subject,
        content: [{ type: 'text/plain', value: text }],
      }),
    });
  } catch (e) {
    console.warn('SendGrid notify skipped/error:', e);
  }
}
