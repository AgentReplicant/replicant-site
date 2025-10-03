// lib/brain/types.ts

export type Slot = {
  start: string;
  end: string;
  label: string;
  disabled?: boolean;
};

export type DateFilter = { y: number; m: number; d: number } | null;

export type BrainResult =
  | { type: "text"; text: string }
  | { type: "slots"; text: string; date: DateFilter; slots: Slot[] }
  | { type: "booked"; when?: string; meetLink?: string }
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

  /** NEW: last seen assistant/user turns for repeat guard & clarifiers */
  lastAssistant?: string;
  lastUser?: string;
};
