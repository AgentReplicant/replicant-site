// app/ui/ChatWidget.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/** ---------- Types ---------- **/
type Msg = { role: "bot" | "user"; text: string; meta?: { link?: string } };

type Slot = {
  start: string;
  end: string;
  label: string;
  disabled?: boolean;
};

type Hist = { role: "user" | "assistant"; content: string }[];

type DateFilter = { y: number; m: number; d: number } | null;

/** ---------- Consts ---------- **/
const STORE_KEY = "replicant_chat_v10";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const NAME_RE = /\b(?:my name is|i'm|i am)\s+([a-z][a-z'’-]+(?:\s+[a-z][a-z'’-]+){0,2})\b/i;
const ET_TZ = "America/New_York";

/** ---------- Helpers ---------- **/
function onlyDigits(s: string) {
  return (s || "").replace(/[^\d]/g, "");
}
function sameYMD(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function ymd(d: Date) {
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

/** Parse simple natural day words client-side so UI never “goes blank”. */
const WD: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
};
function parseNaturalDay(text: string): Date | null {
  const t = text.trim().toLowerCase();
  const now = new Date();
  if (t === "today") return now;
  if (t === "tomorrow" || t === "tmrw") return new Date(now.getTime() + 86400000);
  const m = t.match(
    /^(next\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)$/i
  );
  if (m) {
    const want = WD[m[2].toLowerCase()];
    if (want == null) return null;
    const base = new Date(now);
    let daysAhead = (want - base.getDay() + 7) % 7;
    if (daysAhead === 0 || m[1]) daysAhead += 7;
    return new Date(base.getTime() + daysAhead * 86400000);
  }
  return null;
}

// Extract a loose time from user text; returns minutes since midnight and am/pm if present
function parseLooseTime(text: string): { mins: number; ampm?: "am" | "pm" } | null {
  const m = text.toLowerCase().match(/(around|about|after|before|by)?\s*\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (!m) return null;
  let hh = parseInt(m[2], 10);
  const mm = parseInt(m[3] || "0", 10);
  const ampm = (m[4] as "am" | "pm" | undefined) || undefined;
  if (!ampm) {
    // If no am/pm, assume afternoon/evening if 1–7, morning if 8–11, and 12 -> 12pm
    if (hh === 12) hh = 12;
    else if (hh >= 1 && hh <= 7) hh += 12;
  } else {
    if (ampm === "pm" && hh < 12) hh += 12;
    if (ampm === "am" && hh === 12) hh = 0;
  }
  return { mins: hh * 60 + mm, ampm };
}

/** ---------- Component ---------- **/
export default function ChatWidget() {
  // Window
  const [open, setOpen] = useState(false);
  const [isTall, setIsTall] = useState(false);

  // Chat state
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);

  // Contact state
  const [email, setEmail] = useState<string | undefined>();
  const [phone, setPhone] = useState<string | undefined>();

  // Conversation flow state
  const [date, setDate] = useState<DateFilter>(null);
  const [page, setPage] = useState(0);
  const [lastSlots, setLastSlots] = useState<Slot[] | null>(null);
  const [chosenSlot, setChosenSlot] = useState<Slot | null>(null);
  const [pending, setPending] = useState<null | "mode" | "phone" | "email">(null);
  const [mode, setMode] = useState<"phone" | "video">("phone");

  // Misc
  const wrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<Hist>([]);

  // Session + per-open conversation seed → persona per conversation
  const [sid] = useState(() => {
    const k = "replicant_sid_v1";
    try {
      const v = localStorage.getItem(k);
      if (v) return v;
      const rnd =
        Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(k, rnd);
      return rnd;
    } catch {
      return Math.random().toString(36).slice(2);
    }
  });
  const convoSeed = useMemo(
    () => Math.random().toString(36).slice(2),
    // new seed on mount/open (sufficient for "per conversation")
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open]
  );

  /** ---------- Open via hash or custom event ---------- **/
  useEffect(() => {
    const fromHash = () => {
      try {
        if (typeof window !== "undefined" && location.hash === "#chat") setOpen(true);
      } catch {}
    };
    const onHash = () => fromHash();
    const onOpenEvt = () => setOpen(true);

    fromHash();
    window.addEventListener("hashchange", onHash);
    window.addEventListener("open-chat", onOpenEvt as EventListener);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("open-chat", onOpenEvt as EventListener);
    };
  }, []);

  /** ---------- Restore state ---------- **/
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      const safeDate: DateFilter =
        s?.date &&
        typeof s.date.y === "number" &&
        typeof s.date.m === "number" &&
        typeof s.date.d === "number"
          ? { y: s.date.y, m: s.date.m, d: s.date.d }
          : null;

      setMessages(s.messages ?? []);
      setEmail(s.email ?? undefined);
      setPhone(s.phone ?? undefined);
      setDate(safeDate);
      setPage(s.page ?? 0);
      setLastSlots(s.lastSlots ?? null);
      setChosenSlot(s.chosenSlot ?? null);
      setPending(s.pending ?? null);
      setMode(s.mode ?? "phone");
    } catch {}
  }, []);

  /** ---------- Persist ---------- **/
  useEffect(() => {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          messages,
          email,
          phone,
          date,
          page,
          lastSlots,
          chosenSlot,
          pending,
          mode,
        })
      );
    } catch {}
  }, [messages, email, phone, date, page, lastSlots, chosenSlot, pending, mode]);

  /** ---------- Autoscroll ---------- **/
  useEffect(() => {
    const el = wrapRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, isTall]);

  /** ---------- Auto-resize textarea ---------- **/
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const max = 4 * 22; // ~4 lines
    ta.style.height = Math.min(ta.scrollHeight, max) + "px";
  }, [input]);

  /** ---------- Auto-greet ---------- **/
  useEffect(() => {
    if (!open) return;
    if (messages.length > 0) return;
    if (busy) return;

    let cancelled = false;
    (async () => {
      try {
        setBusy(true);
        const data = await callBrain({ message: "" });
        if (!cancelled) await handleBrainResult(data);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // greet once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** ---------- Logging / lead upsert ---------- **/
  async function logMessage(role: "user" | "assistant", text: string) {
    try {
      await fetch("/api/chatlog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: `${sid}`,
          role,
          message: text,
          source: "Replicant site",
          pageUrl: typeof window !== "undefined" ? window.location.href : "",
        }),
      });
    } catch {}
  }
  async function maybeUpsertLeadFromText(text: string) {
    try {
      const emailMatch = (text.match(EMAIL_RE) || [])[0];
      const phoneMatchRaw = (text.match(PHONE_RE) || [])[0];
      const phoneDigits = onlyDigits(phoneMatchRaw || "");
      const nameMatch = (text.match(NAME_RE) || [])[1];

      if (!emailMatch && phoneDigits.length < 7 && !nameMatch) return;

      await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: nameMatch,
          email: emailMatch,
          phone: phoneDigits || undefined,
          source: "Replicant site",
          status: "Engaged",
        }),
      });
    } catch {}
  }

  /** ---------- Chat helpers ---------- **/
  function appendUser(text: string) {
    setMessages((m) => [...m, { role: "user", text }]);
    historyRef.current.push({ role: "user", content: text });
    void logMessage("user", text);
    void maybeUpsertLeadFromText(text);
  }
  function appendBot(text: string, meta?: { link?: string }) {
    setMessages((m) => [...m, { role: "bot", text, meta }]);
    historyRef.current.push({ role: "assistant", content: text });
    void logMessage("assistant", text);
  }

  async function callBrain(payload: any) {
    const filters = {
      date: date ? { y: date.y, m: date.m, d: date.d } : undefined,
      page,
    };
    const body = {
      ...payload,
      history: historyRef.current,
      filters,
      sessionId: `${sid}:${convoSeed}`, // persona per conversation
    };
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  /** ---------- Natural selection from a slots list ---------- **/
  function selectSlotFromUserText(text: string, slots: Slot[]): Slot | null {
    // 1) Try exact day match + time
    // 2) Try loose time match to closest within current list
    const loose = parseLooseTime(text);
    if (!loose && /later|earlier|more/i.test(text)) return null;

    if (loose) {
      let best: Slot | null = null;
      let bestDelta = Infinity;
      for (const s of slots) {
        const mins = timeFromLabel(s.label);
        if (mins == null) continue;
        const delta = Math.abs(mins - loose.mins);
        if (delta < bestDelta) {
          best = s;
          bestDelta = delta;
        }
      }
      return best;
    }

    // fall back to substring time like “6 pm”/“6:30”
    const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (m) {
      const norm = (m[1] + ":" + (m[2] || "00")).replace(/\b0(\d)\b/, "$1");
      const ampm = (m[3] || "").toUpperCase();
      const pick = slots.find((s) => {
        const lbl = s.label.toUpperCase();
        return lbl.includes(norm) && (!ampm || lbl.includes(ampm));
      });
      if (pick) return pick;
    }
    return null;
  }
  function timeFromLabel(label: string): number | null {
    const m = label.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (!m) return null;
    let hh = parseInt(m[1], 10);
    const mm = parseInt(m[2] || "0", 10);
    const ap = (m[3] || "").toLowerCase();
    if (ap === "pm" && hh < 12) hh += 12;
    if (ap === "am" && hh === 12) hh = 0;
    return hh * 60 + mm;
  }

  /** ---------- Handle result from brain ---------- **/
  async function handleBrainResult(data: any) {
    if (data?.email) setEmail(data.email);

    if (data?.type === "action" && data.action === "open_url" && data.url) {
      appendBot(data.text || "Here’s a secure link:");
      appendBot(`👉 ${data.url}`, { link: data.url });
      return;
    }

    if (data?.type === "slots" && Array.isArray(data.slots)) {
      setLastSlots(data.slots as Slot[]);
      setChosenSlot(null);
      setPending(null);
      appendBot(data.text || "Here are some times in ET. What works?");
      return;
    }

    if (data?.type === "booked") {
      setLastSlots(null);
      setChosenSlot(null);
      setPending(null);
      appendBot("All set — invite sent. Talk soon!");
      return;
    }

    if (data?.type === "error") {
      appendBot(data.text || "That didn’t go through — want to try another time?");
      return;
    }

    if (data?.type === "text" && data.text) {
      appendBot(data.text);
      return;
    }

    if (data?.text) appendBot(data.text);
  }

  /** ---------- Send ---------- **/
  async function handleSend(raw?: string) {
    let val = (raw ?? input).trim();
    if (!val || busy) return;

    appendUser(val);
    setInput("");

    // 1) If awaiting time choice from a recent slot list
    if (lastSlots && !chosenSlot) {
      // “more / later / next”
      if (/^(more|next|later)$/i.test(val)) {
        setPage((p) => p + 1);
        setBusy(true);
        try {
          const data = await callBrain({ message: "book a call" });
          await handleBrainResult(data);
        } finally {
          setBusy(false);
        }
        return;
      }

      // Try to select from loose time
      const sel = selectSlotFromUserText(val, lastSlots);
      if (sel) {
        setChosenSlot(sel);
        // Default to phone unless user says meet/video
        if (/\b(meet|video)\b/i.test(val)) {
          setMode("video");
          setPending("email");
          appendBot("Google Meet it is. What’s the best email for the invite?");
        } else {
          setMode("phone");
          setPending("phone");
          appendBot("Phone works. What’s the best number to call?");
        }
        return;
      }
      // If the user typed a day, let the brain fetch again
      const maybeDay = parseNaturalDay(val);
      if (maybeDay) {
        const now = new Date();
        const chosen = sameYMD(now, maybeDay) ? now : maybeDay;
        const { y, m, d } = ymd(chosen);
        setDate({ y, m, d });
        setPage(0);
        setBusy(true);
        try {
          const data = await callBrain({ message: "book a call" });
          await handleBrainResult(data);
        } finally {
          setBusy(false);
        }
        return;
      }
      // Otherwise fall through to brain for a clarifier
    }

    // 2) Pending mode selection
    if (pending === "mode") {
      if (/\b(meet|video)\b/i.test(val)) {
        setMode("video");
        setPending("email");
        appendBot("Great — drop the best email for the Meet invite?");
      } else {
        setMode("phone");
        setPending("phone");
        appendBot("Phone works. What’s the best number to call?");
      }
      return;
    }

    // 3) Pending phone
    if (pending === "phone") {
      const digits = onlyDigits(val);
      if (digits.length < 7) {
        appendBot("Got it. Could you share the full number with area code?");
        return;
      }
      setPhone(digits);
      setPending("email");
      appendBot("Thanks. What’s the best email for the calendar invite?");
      return;
    }

    // 4) Pending email
    if (pending === "email") {
      if (!EMAIL_RE.test(val)) {
        appendBot("Mind sharing a valid email for the invite?");
        return;
      }
      setEmail(val);

      // Finalize booking
      if (!chosenSlot) {
        appendBot("I didn’t catch the time — which time works for you?");
        return;
      }
      setBusy(true);
      try {
        const booked = await callBrain({
          pickSlot: {
            start: chosenSlot.start,
            end: chosenSlot.end,
            email: val,
            mode,
            phone: mode === "phone" ? phone : undefined,
          },
        });
        await handleBrainResult(booked);
      } finally {
        setBusy(false);
      }
      return;
    }

    // 5) If user asks to book but we don’t have a slots list yet, handle day/time words locally
    const maybeDay = parseNaturalDay(val);
    if (maybeDay) {
      const now = new Date();
      const chosen = sameYMD(now, maybeDay) ? now : maybeDay;
      const { y, m, d } = ymd(chosen);
      setDate({ y, m, d });
      setPage(0);
      setBusy(true);
      try {
        const data = await callBrain({ message: "book a call" });
        await handleBrainResult(data);
      } finally {
        setBusy(false);
      }
      return;
    }

    // Default: ask the brain
    setBusy(true);
    try {
      const data = await callBrain({ message: val });
      await handleBrainResult(data);
      // If brain responded with slots, we’ll follow up from there
      if (data?.type === "slots" && !pending) setPending(null);
    } finally {
      setBusy(false);
    }
  }

  /** ---------- UI ---------- **/
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          data-chat-launcher
          className="fixed bottom-6 right-6 z-[1000] rounded-full border border-slate-300 bg-white text-slate-900 shadow-lg px-5 py-3 text-sm font-medium hover:shadow-2xl transition cursor-pointer"
          aria-label="Open chat"
        >
          Chat with us
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-6 right-6 z-[1000] bg-[#F8FAFC] border border-gray-200 rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: isTall ? 600 : 420, // wider when maximized
            maxWidth: "92vw",
            height: isTall ? "85vh" as any : "620px",
          }}
        >
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
              <div className="font-semibold text-sm text-slate-900">
                Replicant Assistant
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsTall((v) => !v)}
                  className="text-xs text-gray-500 hover:text-black"
                  aria-label="Toggle size"
                >
                  {isTall ? "Minimize" : "Maximize"}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="text-xs text-gray-500 hover:text-black"
                  aria-label="Close chat"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={wrapRef}
              className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#F8FAFC]"
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`w-full flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm border break-words ${
                      m.role === "user"
                        ? "bg-black text-white border-black/20"
                        : "bg-white text-black border-gray-200"
                    }`}
                  >
                    <div className="text-[13px] leading-relaxed">
                      {m.text}
                    </div>
                    {m.meta?.link && (
                      <div className="mt-1">
                        <a
                          className="underline break-all"
                          href={m.meta.link}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {m.meta.link}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="text-xs text-gray-500 px-2">Typing…</div>
              )}
            </div>

            {/* Input (auto-resizing textarea, Enter=send, Shift+Enter=new line) */}
            <div className="bg-white border-t p-2 shrink-0">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend(input);
                    }
                  }}
                  placeholder={
                    email
                      ? "Type your message… (Shift+Enter for new line)"
                      : "Type your message… (Shift+Enter for new line)"
                  }
                  className="flex-1 text-sm border rounded-xl px-3 py-2 outline-none focus:border-black/50 bg-white text-slate-900 placeholder:text-slate-500 resize-none"
                  aria-label="Message input"
                  rows={1}
                />
                <button
                  onClick={() => handleSend(input)}
                  disabled={busy}
                  className="bg-black text-white text-sm px-4 py-2 rounded-xl disabled:opacity-50"
                >
                  Send
                </button>
              </div>

              <div className="text-[10px] text-gray-500 mt-2">
                By continuing, you agree to our TOS. Conversations may be logged to improve service.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
