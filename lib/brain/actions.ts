// lib/brain/actions.ts
import type { DateFilter, Slot } from "./types";

function baseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return explicit || "http://localhost:3000";
}

export async function getSlots(
  date: DateFilter,
  page = 0,
  limit = 12
): Promise<{ slots: Slot[]; date?: DateFilter }> {
  const params = new URLSearchParams();
  if (date) {
    params.set("y", String(date.y));
    params.set("m", String(date.m).padStart(2, "0"));
    params.set("d", String(date.d).padStart(2, "0"));
  }
  params.set("limit", String(limit));
  params.set("page", String(page));

  const res = await fetch(`${baseUrl()}/api/slots?${params.toString()}`, {
    method: "GET",
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({} as any));
  if (!json?.ok) throw new Error(json?.error || "slots failed");
  return { slots: (json.slots || []) as Slot[], date };
}

export async function bookSlot(args: {
  start: string;
  end: string;
  email: string;
  summary?: string;
  description?: string;
}) {
  const res = await fetch(`${baseUrl()}/api/schedule`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(args),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!json?.ok) throw new Error(json?.error || "schedule failed");
  return json as { ok: true; eventId: string; htmlLink?: string; meetLink?: string };
}

export function getCheckoutLink(): { url: string } {
  const url = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || process.env.STRIPE_PAYMENT_LINK;
  if (!url) throw new Error("Payment link not configured");
  return { url };
}
