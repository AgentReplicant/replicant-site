// app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';        // Needed for raw body access
export const dynamic = 'force-dynamic'; // Avoid caching

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whsec) {
    return NextResponse.json({ ok: false, error: 'Missing signature or secret' }, { status: 400 });
  }

  // Stripe requires the **raw** bytes for signature verification
  const rawBody = Buffer.from(await req.arrayBuffer());
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whsec);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // Basic details (extend later with metadata)
      const email = session.customer_details?.email || session.customer_email || '';
      const name = session.customer_details?.name || '';
      const stripeSessionId = session.id;

      await maybeUpdateAirtable({ email, name, stripeSessionId });
      await maybeSendEmail({
        to: process.env.ADMIN_NOTIFY_EMAIL,
        subject: 'Replicant — New Payment',
        text: `New payment from ${name || email} (session ${stripeSessionId}).`,
      });
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error('Webhook handling error:', e);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

async function maybeUpdateAirtable({
  email, name, stripeSessionId,
}: { email?: string; name?: string; stripeSessionId?: string }) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId || !email) return;

  try {
    // Find latest Lead by email
    const list = await fetch(
      `https://api.airtable.com/v0/${baseId}/Leads?filterByFormula=${encodeURIComponent(`{Email}='${email}'`)}&maxRecords=1`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    ).then(r => r.json());

    const recordId = list.records?.[0]?.id;
    if (recordId) {
      await fetch(`https://api.airtable.com/v0/${baseId}/Leads/${recordId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            Status: 'Paid',
            StripePaymentId: stripeSessionId || '',
            Source: 'stripe',
          },
        }),
      });
    }
  } catch (e) {
    console.warn('Airtable update skipped/error:', e);
  }
}

async function maybeSendEmail({
  to, subject, text,
}: { to?: string | null; subject: string; text: string }) {
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
