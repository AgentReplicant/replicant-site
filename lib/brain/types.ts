// lib/brain/types.ts
//
// Brain-specific types. Slot/DateFilter live in lib/shared/types and are
// re-exported here for back-compat with existing brain-internal imports.

export type { Slot, DateFilter } from "@/lib/shared/types";

import type { Slot, DateFilter, QualificationState } from "@/lib/shared/types";

export type BrainResult =
  | {
      type: "text";
      text: string;
      meta?: { link?: string };
      /** Phase 3B: qualification advancement patch — widget merges into local state. */
      qualification?: Partial<QualificationState>;
    }
  | { type: "slots"; text: string; date: DateFilter; slots: Slot[] }
  | { type: "booked"; when?: string }
  | { type: "action"; action: "open_url"; url: string; text?: string }
  | { type: "error"; text: string };

export type BrainCtx = {
  channel: "web" | "instagram" | "whatsapp" | "sms" | "voice";
  tzLabel: string;
  sessionId?: string;
  historyCount?: number;
  page?: number;
  date?: DateFilter;
  lead?: { email?: string; phone?: string; name?: string };

  /** last seen assistant/user turns for repeat guard & clarifiers */
  lastAssistant?: string;
  lastUser?: string;

  /** Phase 3B: current qualification state from the widget. */
  qualification?: QualificationState;
};