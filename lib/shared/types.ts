// lib/shared/types.ts
//
// Neutral, dependency-free shared types used across:
//  - lib/calendar/google.ts
//  - lib/booking/phoneCall.ts (transitively)
//  - lib/brain/* (re-exported via lib/brain/types.ts for back-compat)
//  - app/ui/ChatWidget.tsx
//  - app/api/chat/route.ts
//  - app/api/schedule/route.ts
//
// Rules:
// - No imports from lib/brain/* (brain may depend on this; never the reverse).
// - No imports from lib/airtable/* (LeadPayload stays canonical there;
//   callers that need it import directly from "@/lib/airtable/leads").
// - No runtime code. Types only.

export type Slot = {
  start: string;
  end: string;
  label: string;
  disabled?: boolean;
};

export type DateFilter = { y: number; m: number; d: number } | null;

/**
 * Payload sent from ChatWidget to /api/chat when the user finalizes a slot
 * with phone + email captured. Also the shape destructured by lib/brain/index.ts
 * and validated by /api/schedule (via the booking orchestrator).
 */
export type PickSlotPayload = {
  start: string;
  end: string;
  email: string;
  phone: string;
  name?: string;
};