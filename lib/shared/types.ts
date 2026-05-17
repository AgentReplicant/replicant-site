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

/**
 * Phase 3B — conversational lead qualification.
 *
 * The widget owns persistence (localStorage). The brain receives the current
 * state via BrainCtx.qualification and may return a Partial<QualificationState>
 * patch on its BrainResult, which the widget merges back into state.
 *
 * Field values use the canonical Airtable single-select strings (Phase 3A schema)
 * so they can be written through LeadPayload without translation.
 */
export type QualificationField =
  | "businessCategory"
  | "mainGoal"
  | "desiredTimeline"
  | "budgetRange";

export type QualificationState = {
  /** Is Riley actively trying to qualify this user? Set false when complete or after re-prompt fatigue. */
  active: boolean;
  /** Canonical Airtable values; see lib/airtable/leads.ts LeadPayload for matching keys. */
  businessCategory?: string;
  mainGoal?: string;
  desiredTimeline?: string;
  budgetRange?: string;
  recommendedPackage?: string;
  /** Which field is Riley waiting for next. Null/undefined once recommendation is made. */
  pendingField?: QualificationField;
  /** Categories inferred from a generic question (e.g. "do you build for barbers?") that need user confirmation before being written. */
  pendingCategoryConfirm?: string;
  /** Re-prompt accounting. After 1 ignored re-prompt, qualification.active flips to false. */
  repromptCount?: number;
  /** Which fields have already been upserted to Airtable. Avoids redundant writes. */
  upsertedFields?: QualificationField[];
};

/**
 * Phase 6 — Returning-User Memory.
 *
 * Subset of LeadPayload safe to surface to the brain for personalization.
 * Excludes CRM-internal fields (Notes, StripePaymentId, Source, Conversations).
 *
 * `isUseful` is computed by lib/airtable/leads.toLeadProfile() based on:
 *   A) any qualification-grade field is populated
 *   B) status is in the "useful for welcome-back" set
 *
 * Riley uses `isUseful` to gate the returning-user greeting and uses individual
 * fields to skip already-answered qualification questions. Status itself is
 * NEVER surfaced in user-facing copy — it only affects gating logic.
 */
export type LeadProfile = {
  name?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  businessCategory?: string;
  mainGoal?: string;
  desiredTimeline?: string;
  budgetRange?: string;
  recommendedPackage?: string;
  interestType?: string;
  /** Internal — gates welcome-back eligibility. Never spoken by Riley. */
  status?: string;
  /** True if profile has qualification-grade data OR a useful status. */
  isUseful: boolean;
};