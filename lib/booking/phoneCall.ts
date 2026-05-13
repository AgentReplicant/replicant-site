// lib/booking/phoneCall.ts
//
// Booking orchestrator. Pairs a calendar event insert with a customer confirmation email.
// Single source of truth for "what happens when a Replicant phone call is booked."
//
// Server-only — never import from client components.

import "server-only";

import {
  bookPhoneCall,
  type BookPhoneCallArgs,
  type BookPhoneCallResult,
} from "@/lib/calendar/google";
import { sendCustomerCallConfirmation } from "@/lib/email/sendgrid";

/**
 * Book a phone call AND attempt the customer confirmation email.
 *
 * - The calendar event is authoritative. If it fails, the call throws and no email is sent.
 * - The confirmation email is best-effort: SendGrid failures are logged but never thrown.
 *
 * Throws CalendarError on calendar failures (LEAD_WINDOW, SLOT_TAKEN, BAD_REQUEST, etc.)
 */
export async function bookAndConfirmPhoneCall(
  args: BookPhoneCallArgs
): Promise<BookPhoneCallResult> {
  const result = await bookPhoneCall(args);

  // Best-effort customer confirmation. Never fails the booking.
  await sendCustomerCallConfirmation({
    to: args.email,
    name: args.name,
    phone: result.phone,
    when: result.when,
  });

  return result;
}