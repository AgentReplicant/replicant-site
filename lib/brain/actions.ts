// lib/brain/actions.ts
import { getAvailableSlots } from "@/lib/calendar/google";
import { bookAndConfirmPhoneCall } from "@/lib/booking/phoneCall";
import type { Slot, DateFilter } from "@/lib/brain/types";

export async function getSlots(
  date: DateFilter,
  page = 0,
  limit = 12
): Promise<{ slots: Slot[]; date?: DateFilter }> {
  const slots = await getAvailableSlots({ date, page, limit });
  return { slots, date: date ?? undefined };
}

export async function bookSlot(args: {
  start: string;
  end: string;
  email: string;
  phone: string;
  name?: string;
  notes?: string;
}) {
  return await bookAndConfirmPhoneCall(args);
}

export function getCheckoutLink(): { url: string } {
  const url =
    process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ||
    process.env.STRIPE_PAYMENT_LINK;
  if (!url) throw new Error("Payment link not configured");
  return { url };
}