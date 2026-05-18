# Replicant Sites — Payments

**Last updated:** May 17, 2026

## Role of Stripe in the current funnel

Stripe is used as a **post-scope payment collection layer**, not as a public self-checkout.

Replicant Sites does not expose "Buy Now" buttons on the homepage, pricing section, `/website-audit`, or the chat. Website builds require audit/scope confirmation before payment, because anonymous checkout for a scoped service like a website build creates unwanted obligations with no context (we'd inherit chaos with a receipt).

## Recommended payment flow

1. **Lead qualifies** — via `/website-audit` form or Riley chat qualification
2. **Marlon confirms scope** — package, deliverables, timeline (manual today)
3. **Stripe payment link/invoice sent** — out-of-band (email, text, etc.)
4. **Customer pays** — Stripe Checkout
5. **Stripe webhook fires** — `app/api/stripe/webhook/route.ts` receives `checkout.session.completed`
6. **Lead marked as Won in Airtable** — `Status: Won`, `Source: Stripe`, `StripePaymentId: <session.id>` (via shared `lib/airtable/leads.ts` adapter)
7. **Admin notification sent** — best-effort email to `ADMIN_NOTIFY_EMAIL` (via shared `lib/email/sendgrid.ts` adapter)
8. **Project moves to Website In Progress** — manually for now, future automation TBD

## Riley's allowed language

Riley may say things like:

> "Once scope is confirmed, Marlon can send over the payment link."

Riley **must not**:

- Route users directly to Stripe Checkout
- Surface a payment link before scope is confirmed
- Say "buy now," "checkout," or imply self-service purchase

## Current package pricing

| Package | Setup |
| --- | --- |
| Starter Website | $750 |
| Booking / Quote Website | $1,250 |
| Website + Replicant Assistant | $2,000 |

Monthly support / assistant pricing is **TBD**. Will be defined when the assistant product is ready (Phase 9).

## Webhook details

**Route:** `app/api/stripe/webhook/route.ts`

**Behavior:**
- Verifies Stripe signature via `stripe.webhooks.constructEvent` with raw body buffer
- Handles `checkout.session.completed`; all other event types are no-ops
- Extracts `email`, `name`, `phone` from `customer_details`
- Phone is rarely present unless `phone_number_collection: { enabled: true }` is set on the Checkout Session
- Skips Airtable upsert entirely if no email is present (email is the lookup key)
- Idempotency: if a lead already exists with `StripePaymentId` matching the current session id, **both** the Airtable upsert and the admin notification are skipped (Stripe retries webhooks on non-2xx; this avoids duplicate admin emails too)
- **Source overwrite caveat:** an existing lead originally captured as `Source: "Website Audit"` or any other source will have its `Source` field overwritten to `"Stripe"` when payment completes. This is acceptable for now — attribution loss is the tradeoff for keeping the schema simple. If attribution matters later, add a separate `Payment Source` or `Last Event Source` field instead of overloading `Source`.
- Calls `upsertLead` from `lib/airtable/leads.ts` (shared adapter — Phase 5D extraction)
- Calls `sendAdminPaymentNotification` from `lib/email/sendgrid.ts` (shared adapter — Phase 5D extraction)
- Admin email is best-effort: failures log but never fail the webhook

**No customer-facing receipt is sent.** Stripe sends its own automatic email receipt to the customer based on Stripe Dashboard settings (Settings → Customer emails → "Successful payments"). A Replicant-branded customer receipt could be added later as `sendCustomerPaymentReceipt` in `lib/email/sendgrid.ts` if needed — not currently in scope.

## Env vars

| Env | Purpose | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Stripe SDK | Required for webhook |
| `STRIPE_WEBHOOK_SECRET` | Signature verification | Required for webhook |
| `ADMIN_NOTIFY_EMAIL` | Admin payment notification recipient | If unset, notification is skipped |
| `SENDGRID_API_KEY` | Admin notification sending | If unset, notification is skipped |
| `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` | **Legacy / deprecated** | Still read by `app/cancel/page.tsx`. Not surfaced as a primary CTA. Do not remove from Vercel without auditing the cancel page first. |
| `STRIPE_PAYMENT_LINK` | **Legacy / deprecated** | Was read by removed `getCheckoutLink()` helper in `lib/brain/actions.ts`. Safe to remove from Vercel. |

## Refund / scope boundaries

*Placeholder — to be defined.* Until written, refunds and scope disputes are handled manually case-by-case.

## Legacy surfaces to revisit

- `app/cancel/page.tsx` exposes `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` directly. Originally part of the old AI-agent checkout funnel. Not user-routed today. Should be cleaned up or repurposed if the cancel flow is never reached in the current funnel.
- `app/onboarding/` is a dormant Stripe-paid intake flow. Not user-routed today.