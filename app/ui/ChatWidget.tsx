// app/ui/ChatWidget.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Msg = { role: "bot" | "user"; text: string; meta?: { link?: string } };
type Slot = { start: string; end: string; label: string; disabled?: boolean };
type Hist = { role: "user" | "assistant"; content: string }[];
type DateFilter = { y: number; m: number; d: number } | null;

const STORE_KEY = "replicant_chat_v12";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
// Non-anchored version for extracting an email from inside a longer message.
const EMAIL_EXTRACT_RE = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const NAME_RE =
  /\b(?:my name is|i'm|i am)\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){0,2})\b/i;

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

const WD: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function parseNaturalDay(text: string): Date | null {
  const t = text.trim().toLowerCase();
  const now = new Date();
  if (t === "today") return now;
  if (t === "tomorrow" || t === "tmrw")
    return new Date(now.getTime() + 86400000);

  // "May 12", "may 12th", "Jan 3" — picks the next future occurrence of that
  // month/day (this year or next year if the date already passed).
  const md = t.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i
  );
  if (md) {
    const monIdx = MONTHS[md[1].toLowerCase()];
    const day = parseInt(md[2], 10);
    if (monIdx != null && day >= 1 && day <= 31) {
      let year = now.getFullYear();
      let candidate = new Date(year, monIdx, day);
      // If the candidate is more than a day in the past, roll forward a year
      if (candidate.getTime() < now.getTime() - 86400000) {
        candidate = new Date(year + 1, monIdx, day);
      }
      return candidate;
    }
  }

  // Weekday: "wed", "next friday", etc.
  // - "tuesday" when today is Tuesday → today (not next week).
  //   The user is choosing from already-offered slots, not asking for "the week after".
  // - "next tuesday" → always jumps a week.
  const wd = t.match(
    /(?:^|\b)(next\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)(?:\b|$)/i
  );
  if (wd) {
    const want = WD[wd[2].toLowerCase()];
    if (want == null) return null;
    const base = new Date(now);
    let daysAhead = (want - base.getDay() + 7) % 7;
    // Only push to next week if user explicitly said "next" — same-day match returns today.
    if (wd[1]) daysAhead += 7;
    return new Date(base.getTime() + daysAhead * 86400000);
  }

  return null;
}

function parseLooseTime(
  text: string
): { mins: number; ap?: "am" | "pm" } | null {
  const m = text
    .toLowerCase()
    .match(
      /(around|about|after|before|by)?\s*\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/
    );
  if (!m) return null;
  let hh = parseInt(m[2], 10);
  const mm = parseInt(m[3] || "0", 10);
  const ap = (m[4] as "am" | "pm" | undefined) || undefined;
  if (!ap) {
    if (hh === 12) hh = 12;
    else if (hh >= 1 && hh <= 7) hh += 12;
  } else {
    if (ap === "pm" && hh < 12) hh += 12;
    if (ap === "am" && hh === 12) hh = 0;
  }
  return { mins: hh * 60 + mm, ap };
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

function renderTextWithLink(text: string, link?: string): React.ReactNode {
  if (!link || !text.includes(link)) return text;
  const idx = text.indexOf(link);
  const before = text.slice(0, idx);
  const after = text.slice(idx + link.length);
  return (
    <>
      {before}
      <a className="underline" href={link} target="_blank" rel="noopener noreferrer">
        {link}
      </a>
      {after}
    </>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [isTall, setIsTall] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | undefined>();
  const [phone, setPhone] = useState<string | undefined>();
  const [name, setName] = useState<string | undefined>();
  const [date, setDate] = useState<DateFilter>(null);
  const [page, setPage] = useState(0);
  const [lastSlots, setLastSlots] = useState<Slot[] | null>(null);
  const [chosenSlot, setChosenSlot] = useState<Slot | null>(null);
  const [pending, setPending] = useState<null | "phone" | "email" | "email_handoff">(
    null
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<Hist>([]);
  const restoredRef = useRef(false);

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
    [open]
  );

  /* Open triggers */
  useEffect(() => {
    const fromHash = () => {
      if (typeof window !== "undefined" && location.hash === "#chat")
        setOpen(true);
    };
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("open-chat", () => setOpen(true) as any);
    fromHash();
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener("open-chat", () => setOpen(true) as any);
    };
  }, []);

  /* Restore */
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
      const restoredMessages: Msg[] = s.messages ?? [];
      setMessages(restoredMessages);
      setEmail(s.email ?? undefined);
      setPhone(s.phone ?? undefined);
      setName(s.name ?? undefined);
      setDate(safeDate);
      setPage(s.page ?? 0);
      setLastSlots(s.lastSlots ?? null);
      setChosenSlot(s.chosenSlot ?? null);
      // Whitelist pending state — any old "mode" value from prior versions becomes null
      const validPending =
        s.pending === "phone" || s.pending === "email" || s.pending === "email_handoff"
          ? s.pending
          : null;
      setPending(validPending);

      if (restoredMessages.length > 0) {
        historyRef.current = restoredMessages.map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.text,
        }));
        restoredRef.current = true;
      }
    } catch {}
  }, []);

  /* Persist */
  useEffect(() => {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          messages, email, phone, name, date, page,
          lastSlots, chosenSlot, pending,
        })
      );
    } catch {}
  }, [messages, email, phone, name, date, page, lastSlots, chosenSlot, pending]);

  /* Autoscroll */
  useEffect(() => {
    const el = wrapRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, isTall]);

  /* Auto-resize textarea */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const max = 4 * 22;
    ta.style.height = Math.min(ta.scrollHeight, max) + "px";
  }, [input]);

  /* Auto-greet — skip if we restored a prior conversation */
  useEffect(() => {
    if (!open || messages.length > 0 || busy) return;
    if (restoredRef.current) return;
    let stop = false;
    (async () => {
      setBusy(true);
      try {
        const data = await callBrain({ message: "" });
        if (!stop) await handleBrainResult(data);
      } finally {
        if (!stop) setBusy(false);
      }
    })();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function logMessage(role: "user" | "assistant", text: string) {
    try {
      await fetch("/api/chatlog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: `${sid}`,
          role,
          message: text,
          source: "Chat - Replicant",
          pageUrl:
            typeof window !== "undefined" ? window.location.href : "",
        }),
      });
    } catch {}
  }

  async function maybeUpsertLeadFromText(text: string) {
    try {
      const emailMatch = (text.match(EMAIL_EXTRACT_RE) || [])[0];
      const phoneMatchRaw = (text.match(PHONE_RE) || [])[0];
      const phoneDigits = onlyDigits(phoneMatchRaw || "");
      const nameMatch = (text.match(NAME_RE) || [])[1];

      if (emailMatch && !email) setEmail(emailMatch);
      if (phoneDigits.length >= 7 && !phone) setPhone(phoneDigits);
      if (nameMatch && !name) setName(nameMatch);

      if (!emailMatch && phoneDigits.length < 7 && !nameMatch) return;
      await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: nameMatch,
          email: emailMatch,
          phone: phoneDigits || undefined,
          source: "Chat - Replicant",
        }),
      });
    } catch {}
  }

  function appendUser(text: string) {
    setMessages((m) => [...m, { role: "user", text }]);
    historyRef.current.push({ role: "user", content: text });
    void logMessage("user", text);
    // Skip opportunistic lead capture if we're in the email-handoff state —
    // the handoff handler will write the lead with the correct source/status,
    // and we'd otherwise race two writes to Airtable.
    if (pending !== "email_handoff") {
      void maybeUpsertLeadFromText(text);
    }
  }

  function appendBot(text: string, meta?: { link?: string }) {
    setMessages((m) => [...m, { role: "bot", text, meta }]);
    historyRef.current.push({ role: "assistant", content: text });
    void logMessage("assistant", text);
  }

  async function callBrain(payload: any, overrides?: { page?: number; date?: DateFilter }) {
    const usePage = overrides?.page ?? page;
    const useDate = overrides?.date !== undefined ? overrides.date : date;
    const filters = {
      date: useDate ? { y: useDate.y, m: useDate.m, d: useDate.d } : undefined,
      page: usePage,
    };
    const body = {
      ...payload,
      history: historyRef.current,
      filters,
      sessionId: `${sid}:${convoSeed}`,
      email,
      phone,
      name,
    };
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  function selectSlotFromUserText(text: string, slots: Slot[]): Slot | null {
    if (/\bmorning|afternoon|evening\b/i.test(text)) return null;

    // If the user named a day (weekday, today/tomorrow, or "May 12"),
    // narrow candidates to that day so we don't match wrong-day slots
    // when the day word's digits leak into time parsing.
    const dayDate = parseNaturalDay(text);
    let candidates = slots;
    if (dayDate) {
      const sameDaySlots = slots.filter((s) => sameYMD(new Date(s.start), dayDate));
      // If user named a day that isn't in the offered list, refuse rather than
      // silently fall back to all slots and book the wrong day.
      if (sameDaySlots.length === 0) return null;
      candidates = sameDaySlots;
    }

    // Strip day words and month+day phrases before parsing time, so
    // "may 12 at 4:30" doesn't get its "12" parsed as the hour.
    const timeOnlyText = text
      .replace(
        /\b(today|tmrw|tomorrow|sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/gi,
        ""
      )
      .replace(
        /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
        ""
      )
      .trim();

    const loose = parseLooseTime(timeOnlyText);
    if (!loose) return null;

    let best: Slot | null = null;
    let bestDelta = Infinity;
    for (const s of candidates) {
      const mins = timeFromLabel(s.label);
      if (mins == null) continue;
      const delta = Math.abs(mins - loose.mins);
      if (delta < bestDelta) {
        best = s;
        bestDelta = delta;
      }
    }
    if (best && bestDelta <= 75) return best;
    return null;
  }

  async function handleBrainResult(data: any) {
    if (data?.email) setEmail(data.email);

    if (data?.type === "action" && data.action === "open_url" && data.url) {
      appendBot(data.text || "Here's the link:");
      appendBot(`${data.url}`, { link: data.url });
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
      const confirmation = data.when
        ? `All set for ${data.when}. We'll call you at the number you provided. A confirmation email is on its way.`
        : "All set. We'll call you at the number you provided. A confirmation email is on its way.";
      appendBot(confirmation);
      return;
    }

    if (data?.type === "error") {
      appendBot(
        data.text || "That didn't go through — want to try another time?"
      );
      return;
    }

    if (data?.type === "text" && data.text) {
      appendBot(data.text, data.meta?.link ? { link: data.meta.link } : undefined);

      // If the brain just offered the email handoff prompt, enter email_handoff pending state
      // Match multiple phrasings since LLM tone-smoothing rewrites the copy
      if (/best email (?:address )?to reach you/i.test(data.text) || /email (?:address )?(?:works?|for|to (?:reach|contact|follow))/i.test(data.text)) {      
        setPending("email_handoff");
      }
      return;
    }

    if (data?.text) appendBot(data.text);
  }

  async function handleSend(raw?: string) {
    const val = (raw ?? input).trim();
    if (!val || busy) return;
    appendUser(val);
    setInput("");

    // ---------- Email handoff capture ----------
    if (pending === "email_handoff") {
      const emailMatch = (val.match(EMAIL_EXTRACT_RE) || [])[0];
      if (!emailMatch) {
        appendBot("Mind sharing a valid email so we can follow up?");
        return;
      }
      setEmail(emailMatch);
      setPending(null);
      // Save the email-handoff lead with a clear source
      try {
        await fetch("/api/lead", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name,
            email: emailMatch,
            phone,
            message: `Email handoff requested via chat. Last note: ${val}`,
            source: "Chat - Email Handoff",
            status: "Needs Follow-Up",
          }),
        });
      } catch {}
      appendBot("Thanks — I'll make sure someone follows up by email within one business day.");
      return;
    }

    // ---------- If we have a slot list and no selection yet ----------
    if (lastSlots && !chosenSlot) {
      if (/^(more|next|later)$/i.test(val)) {
        const nextPage = page + 1;
        setPage(nextPage);
        setBusy(true);
        try {
          const data = await callBrain({ message: "book a call" }, { page: nextPage });
          await handleBrainResult(data);
        } finally {
          setBusy(false);
        }
        return;
      }

      const sel = selectSlotFromUserText(val, lastSlots);
      if (sel) {
        setChosenSlot(sel);
        setPending("phone");
        appendBot("Got it. What's the best number to call?");
        return;
      }

      const maybeDay = parseNaturalDay(val);
      if (maybeDay) {
        const now = new Date();
        const chosen = sameYMD(now, maybeDay) ? now : maybeDay;
        const { y, m, d } = ymd(chosen);
        setDate({ y, m, d });
        setPage(0);
        setBusy(true);
        try {
          const newDate = { y, m, d };
          const data = await callBrain({ message: val }, { page: 0, date: newDate });
          await handleBrainResult(data);
        } finally {
          setBusy(false);
        }
        return;
      }
    }

    if (pending === "phone") {
      const digits = onlyDigits(val);
      if (digits.length < 7) {
        appendBot("Could you share the full number with area code?");
        return;
      }
      setPhone(digits);
      setPending("email");
      appendBot("Thanks. What's the best email for your confirmation?");
      return;
    }

    if (pending === "email") {
      if (!EMAIL_RE.test(val)) {
        appendBot("Mind sharing a valid email for the invite?");
        return;
      }
      setEmail(val);
      if (!chosenSlot) {
        appendBot("I didn't catch the time — which time works for you?");
        return;
      }
      setBusy(true);
      try {
        const booked = await callBrain({
          pickSlot: {
            start: chosenSlot.start,
            end: chosenSlot.end,
            email: val,
            phone,
            name,
          },
        });
        await handleBrainResult(booked);
      } finally {
        setBusy(false);
      }
      return;
    }

    // ---------- Day word → lock date ----------
    const maybeDay = parseNaturalDay(val);
    if (maybeDay) {
      const now = new Date();
      const chosen = sameYMD(now, maybeDay) ? now : maybeDay;
      const { y, m, d } = ymd(chosen);
      setDate({ y, m, d });
      setPage(0);
      setBusy(true);
      try {
        const newDate = { y, m, d };
        const data = await callBrain({ message: val }, { page: 0, date: newDate });
        await handleBrainResult(data);
      } finally {
        setBusy(false);
      }
      return;
    }

    // ---------- Otherwise pass to brain ----------
    setBusy(true);
    try {
      const data = await callBrain({ message: val });
      await handleBrainResult(data);
    } finally {
      setBusy(false);
    }
  }

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
            width: isTall ? 600 : 420,
            maxWidth: "92vw",
            height: isTall ? ("85vh" as any) : "620px",
          }}
        >
          <div className="h-full flex flex-col">
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
                  Close
                </button>
              </div>
            </div>

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
                      {renderTextWithLink(m.text, m.meta?.link)}
                    </div>
                    {m.meta?.link && !m.text.includes(m.meta.link) && (
                      <div className="mt-1">
                        <a
                          className="underline break-all"
                          href={m.meta.link}
                          target="_blank"
                          rel="noopener noreferrer"
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
                  placeholder="Type your message… (Shift+Enter for new line)"
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
                By continuing, you agree to our TOS. Conversations may be logged
                to improve service.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}