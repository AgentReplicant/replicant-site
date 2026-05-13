// lib/email/sendgrid.ts
//
// Shared SendGrid adapter. Currently only exposes the customer call confirmation.
// All SendGrid network access lives here; no other module should call SendGrid directly.
//
// Server-only — never import from client components.

import "server-only";

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "agentreplicant@gmail.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "Replicant";

export type CustomerCallConfirmationArgs = {
  to: string;
  name?: string;
  phone: string;
  when: string;
};

/**
 * Send the customer their phone-call confirmation.
 * Best-effort: try/catch internally, never throws, never fails the booking.
 */
export async function sendCustomerCallConfirmation(
  args: CustomerCallConfirmationArgs
): Promise<void> {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    console.warn("[sendgrid] skipped: no SENDGRID_API_KEY");
    return;
  }
  if (!args.to) {
    console.warn("[sendgrid] skipped: no recipient email");
    return;
  }

  const greeting = args.name ? `Hi ${args.name},` : "Hi,";
  const text = [
    greeting,
    "",
    `Your call with Replicant is booked for ${args.when}.`,
    "",
    `We'll call you at: ${args.phone}.`,
    "",
    "If anything changes, just reply to this email and we'll sort it out.",
    "",
    "— Marlon, Replicant",
  ].join("\n");

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: args.to }] }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject: `Your Replicant call is booked — ${args.when}`,
        content: [{ type: "text/plain", value: text }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[sendgrid] non-OK", { status: res.status, body });
    } else {
      console.log("[sendgrid] sent", { to: args.to });
    }
  } catch (e: any) {
    console.warn("[sendgrid] error", e?.message || e);
  }
}