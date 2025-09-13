// app/ui/ChatWidget.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

type Msg = { role: "bot" | "user"; text: string; meta?: { link?: string } };

type Slot = {
  start: string;
  end: string;
  label: string;
  disabled?: boolean; // greyed-out / unselectable (taken, outside hours, etc.)
};

type Hist = { role: "user" | "assistant"; content: string }[];

type DateFilter = { y: number; m: number; d: number } | null;

const STORE_KEY = "replicant_chat_v9";

// ---------- Utility: dates ----------
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const BOOKING_LEAD_MINUTES = 60; // show no slots inside next 60 min
const BOOKING_LEAD_MS = BOOKING_LEAD_MINUTES * 60_000;

function nextNDays(n = 14) {
  const out: Date[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) out.push(new Date(now.getTime() + i * DAY_MS));
  return out;
}
function ymd(d: Date) {
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}
function dayLabel(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function sameYMD(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

// ---------- Utility: parse natural day phrases ----------
const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function parseDayPhrase(input: string): Date | null {
  const val = input.trim().toLowerCase();

  if (/^today\b/.test(val)) return new Date();

  if (/^tomorrow\b/.test(val)) return new Date(Date.now() + DAY_MS);

  // e.g. "monday", "this tuesday", "on wed", "next sunday"
  const m = /^(?:on\s+|this\s+|next\s+)?([a-z]+)(?:\s+next)?$/.exec(val);
  if (!m) return null;
  const wdName = m[1];
  if (!(wdName in WEEKDAYS)) return null;

  const target = WEEKDAYS[wdName];
  const now = new Date();
  const today = now.getDay();

  let delta = (target - today + 7) % 7;
  // if user typed the weekday that is *today* and didn't say "today", push to the upcoming same weekday
  if (delta === 0 && !/^this\s+|^on\s+/.test(val)) delta = 7;

  return new Date(now.getTime() + delta * DAY_MS);
}

export default function ChatWidget() {
  // UI state
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isTall, setIsTall] = useState(false);

  // Chat state
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [email, setEmail] = useState<string | undefined>();

  // Scheduling state
  const [showScheduler, setShowScheduler] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [askedDayOnce, setAskedDayOnce] = useState(false);

  const [date, setDate] = useState<DateFilter>(null); // null means "no filter"
  const [page, setPage] = useState(0);
  const [slots, setSlots] = useState<Slot[] | null>(null);

  // Inline confirm state
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");

  // Quick chips
  const [suggestions, setSuggestions] = useState([
    { label: "Pick a day", value: "book a call" },
    { label: "Keep explaining", value: "please keep explaining" },
    { label: "Pricing", value: "how much is it?" },
    { label: "Pay now", value: "pay now" },
  ]);

  // Misc
  const wrapRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<Hist>([]);

  // Open on #chat or custom event
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

  // Restore from localStorage (with safe date guard)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
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
        setSlots(s.slots ?? null);
        setDate(safeDate);
        setPage(s.page ?? 0);
        setShowScheduler(s.showScheduler ?? false);
        setShowDayPicker(s.showDayPicker ?? false);
        setIsTall(s.isTall ?? false);
        setAskedDayOnce(s.askedDayOnce ?? false);

        setSelectedSlot(s.selectedSlot ?? null);
        setConfirmEmail(s.confirmEmail ?? "");
        setSuggestions(
          Array.isArray(s.suggestions) && s.suggestions.length > 0
            ? s.suggestions
            : [
                { label: "Pick a day", value: "book a call" },
                { label: "Keep explaining", value: "please keep explaining" },
                { label: "Pricing", value: "how much is it?" },
                { label: "Pay now", value: "pay now" },
              ]
        );
      } else {
        setMessages([
          { role: "bot", text: "Hey — I can answer questions, book a quick Zoom, or get you set up now." },
        ]);
      }
    } catch {
      setMessages([
        { role: "bot", text: "Hey — I can answer questions, book a quick Zoom, or get you set up now." },
      ]);
    }
  }, []);

  // Autoscroll
  useEffect(() => {
    const el = wrapRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, slots, showDayPicker, showScheduler, isTall, selectedSlot]);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          messages,
          email,
          slots,
          date,
          page,
          showScheduler,
          showDayPicker,
          isTall,
          askedDayOnce,
          selectedSlot,
          confirmEmail,
          suggestions,
        })
      );
    } catch {}
  }, [
    messages,
    email,
    slots,
    date,
    page,
    showScheduler,
    showDayPicker,
    isTall,
    askedDayOnce,
    selectedSlot,
    confirmEmail,
    suggestions,
  ]);

  // Helpers
  function appendUser(text: string) {
    setMessages((m) => [...m, { role: "user", text }]);
    historyRef.current.push({ role: "user", content: text });
  }
  function appendBot(text: string, meta?: { link?: string }) {
    setMessages((m) => [...m, { role: "bot", text, meta }]);
    historyRef.current.push({ role: "assistant", content: text });
  }

  async function callBrain(payload: any) {
    const filters = { date: date ? { y: date.y, m: date.m, d: date.d } : undefined, page };
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, history: historyRef.current, filters }),
    });
    return res.json();
  }

  function resetSchedulingUI() {
    setSlots(null);
    setSelectedSlot(null);
    setConfirmEmail("");
    setShowDayPicker(false);
    setShowScheduler(false);
    setPage(0);
    setAskedDayOnce(false);
    setDate(null); // do NOT use {}
    setSuggestions([
      { label: "Pick a day", value: "book a call" },
      { label: "Keep explaining", value: "please keep explaining" },
    ]);
  }

  async function handleBrainResult(data: any) {
    if (data?.email) setEmail(data.email);

    if (data?.type === "action" && data.action === "open_url" && data.url) {
      resetSchedulingUI();
      setSuggestions([
        { label: "Pick a day", value: "book a call" },
        { label: "Keep explaining", value: "please keep explaining" },
      ]);
      appendBot(data.text || "Here’s a secure checkout:");
      appendBot(`👉 ${data.url}`, { link: data.url });
      return;
    }

    if (data?.type === "slots" && Array.isArray(data.slots)) {
      if (data.date) setDate(data.date);
      setShowScheduler(true);
      setShowDayPicker(false);
      setSlots(data.slots as Slot[]);
      setSelectedSlot(null);
      setConfirmEmail(email ?? "");

      if (!askedDayOnce) {
        appendBot(data.text || "Pick a time that works (ET):");
        setAskedDayOnce(true);
      }
      setSuggestions([]); // while in scheduler, hide chips
      return;
    }

    if (data?.type === "booked") {
      resetSchedulingUI();
      const when = data.when ? ` (${data.when})` : "";
      const meet = data.meetLink ? `\nMeet link: ${data.meetLink}` : "";
      appendBot(`All set!${when}${meet}`);
      return;
    }

    if (data?.type === "error") {
      // keep scheduler open for retry
      setSelectedSlot(null);
      setConfirmEmail(email ?? "");
      appendBot(data.text || "That time was just taken — here are the latest available times.");
      try {
        const again = await callBrain({ message: "book a call" });
        if (again?.type === "slots") {
          setShowScheduler(true);
          setShowDayPicker(false);
          setSlots(again.slots as Slot[]);
        }
      } catch {}
      return;
    }

    if (data?.type === "text" && data.text) {
      appendBot(data.text);
      if (!showScheduler) {
        setSuggestions([
          { label: "Pick a day", value: "book a call" },
          { label: "Keep explaining", value: "please keep explaining" },
          { label: "Pricing", value: "how much is it?" },
          { label: "Pay now", value: "pay now" },
        ]);
      }
      return;
    }

    if (data?.text) appendBot(data.text);
  }

  // Sending messages / email inline
  async function handleSend(text?: string) {
    const val = (text ?? input).trim();
    if (!val || busy) return;

    // Natural-day intercept: "today", "tomorrow", "monday", "next sunday", etc.
    const parsed = parseDayPhrase(val);
    if (parsed) {
      appendUser(val);
      // Flip into scheduler mode immediately
      setSuggestions([]);
      setShowScheduler(true);
      setShowDayPicker(false);
      await chooseDay(parsed); // chooseDay will call the brain
      setInput("");
      return;
    }

    // If user typed an email while inline-confirm is visible
    if (selectedSlot && EMAIL_RE.test(val) && !email) {
      setBusy(true);
      appendUser(val);
      setInput("");
      try {
        setEmail(val);
        const booked = await callBrain({
          pickSlot: { start: selectedSlot.start, end: selectedSlot.end, email: val },
        });
        await handleBrainResult(booked);
      } finally {
        setBusy(false);
      }
      return;
    }

    appendUser(val);
    setInput("");
    setBusy(true);
    try {
      const data = await callBrain({ message: val });
      await handleBrainResult(data);
    } finally {
      setBusy(false);
    }
  }

  async function pickSlot(slot: Slot) {
    if (busy || slot.disabled) return;
    setSelectedSlot(slot);
    setConfirmEmail(email ?? "");
  }

  async function confirmSelected() {
    if (!selectedSlot) return;
    const chosenEmail = (confirmEmail || "").trim();

    if (!EMAIL_RE.test(chosenEmail)) {
      appendBot("What’s the best email for the invite?");
      return;
    }

    setBusy(true);
    try {
      const data = await callBrain({
        pickSlot: { start: selectedSlot.start, end: selectedSlot.end, email: chosenEmail },
      });
      await handleBrainResult(data);
    } finally {
      setBusy(false);
    }
  }

  async function chooseDay(d: Date) {
    const { y, m, d: dd } = ymd(d);
    setDate({ y, m, d: dd });
    setPage(0);
    setBusy(true);
    setSelectedSlot(null);
    setConfirmEmail(email ?? "");
    try {
      const data = await callBrain({ message: "book a call" });
      await handleBrainResult(data);
    } finally {
      setBusy(false);
    }
  }

  async function showMoreTimes() {
    setPage((p) => p + 1);
    setBusy(true);
    try {
      const data = await callBrain({ message: "book a call" });
      await handleBrainResult(data);
    } finally {
      setBusy(false);
    }
  }

  const dayButtons = nextNDays(14).map((d) => (
    <button
      key={d.toDateString()}
      onClick={() => chooseDay(d)}
      className={`text-xs border rounded-full px-3 py-1 hover:bg-black hover:text-white transition ${
        date && sameYMD(d, new Date(date.y, date.m - 1, date.d)) ? "bg-black text-white" : ""
      }`}
      disabled={busy}
      title={d.toLocaleDateString()}
    >
      {dayLabel(d)}
    </button>
  ));

  // Hide any slot that is "in the past" (inside the next 60 minutes).
  const renderSlots: Slot[] =
    (slots ?? []).filter((s) => {
      const startMs = new Date(s.start).getTime();
      const nowMs = Date.now();
      return startMs - nowMs >= BOOKING_LEAD_MS;
    });

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
          className="fixed bottom-6 right-6 z-[1000] w-[420px] max-w-[92vw] bg-[#F8FAFC] border border-gray-200 rounded-2xl shadow-2xl overflow-hidden"
          style={{ height: isTall ? "80vh" : "620px" }}
        >
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
              <div className="font-semibold text-sm text-slate-900">Replicant Assistant</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsTall((v) => !v)}
                  className="text-xs text-gray-500 hover:text-black"
                  aria-label="Toggle height"
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
            <div ref={wrapRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#F8FAFC]">
              {messages.map((m, i) => (
                <div key={i} className={`w-full flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm border break-words ${
                      m.role === "user"
                        ? "bg-black text-white border-black/20"
                        : "bg-white text-black border-gray-200"
                    }`}
                  >
                    <div className="text-[13px] leading-relaxed">{m.text}</div>
                    {m.meta?.link && (
                      <div className="mt-1">
                        <a className="underline break-all" href={m.meta.link} target="_blank" rel="noreferrer">
                          {m.meta.link}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Scheduler */}
              {showScheduler && (
                <div className="mt-3 border border-gray-200 bg-white rounded-xl">
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <div className="text-xs font-medium text-slate-800">Scheduling</div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowScheduler(false)} className="text-xs underline">
                        Hide
                      </button>
                      <button onClick={resetSchedulingUI} className="text-xs underline">
                        Reset
                      </button>
                    </div>
                  </div>

                  {showDayPicker && (
                    <div className="px-3 py-2">
                      <div className="text-xs text-gray-600 mb-1">Pick a day:</div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => chooseDay(new Date())}
                          className="text-xs border rounded-full px-3 py-1 hover:bg-black hover:text-white transition"
                          disabled={busy}
                        >
                          Today
                        </button>
                        <button
                          onClick={() => chooseDay(new Date(Date.now() + DAY_MS))}
                          className="text-xs border rounded-full px-3 py-1 hover:bg-black hover:text-white transition"
                          disabled={busy}
                        >
                          Tomorrow
                        </button>
                        {dayButtons}
                      </div>
                    </div>
                  )}

                  {slots && (
                    <div className="px-3 py-2">
                      <div className="text-xs text-gray-600 mb-1">
                        {date
                          ? `Times for ${new Date(date.y, date.m - 1, date.d).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}`
                          : "Quick picks"}
                        :
                      </div>
                      <div className="text-[10px] text-gray-500 mb-2">All times shown in Eastern Time (ET).</div>

                      <div className="flex flex-wrap gap-2">
                        {renderSlots.map((s) => {
                          const isChosen = selectedSlot?.start === s.start && selectedSlot?.end === s.end;
                          const base =
                            "text-xs border rounded-full px-3 py-1 transition focus:outline-none focus:ring-1";
                          const enabled = "hover:bg-black hover:text-white";
                          const disabledStyle = "opacity-50 line-through cursor-not-allowed";

                          return (
                            <button
                              key={s.start}
                              onClick={() => pickSlot(s)}
                              className={`${base} ${s.disabled ? disabledStyle : enabled} ${
                                isChosen ? "bg-black text-white" : ""
                              }`}
                              disabled={busy || !!(s.disabled)}
                              title={s.disabled ? "Unavailable" : "Pick this time"}
                            >
                              {s.label}
                            </button>
                          );
                        })}

                        <button
                          onClick={showMoreTimes}
                          className="text-xs border rounded-full px-3 py-1 hover:bg-black hover:text-white transition"
                          disabled={busy}
                        >
                          More times →
                        </button>
                        <button
                          onClick={() => setShowDayPicker(true)}
                          className="text-xs border rounded-full px-3 py-1 hover:bg-black hover:text-white transition"
                          disabled={busy}
                        >
                          ← Change day
                        </button>
                      </div>

                      {/* Inline confirm bar */}
                      {selectedSlot && (
                        <div className="mt-3 border-t pt-2 flex flex-col gap-2">
                          <div className="text-[12px]">
                            <span className="font-medium">Selected:</span> {selectedSlot.label}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => setSelectedSlot(null)}
                              className="text-xs underline"
                              disabled={busy}
                            >
                              Change time
                            </button>

                            <input
                              value={confirmEmail}
                              onChange={(e) => setConfirmEmail(e.target.value)}
                              placeholder="Enter your email to confirm"
                              className="text-xs border rounded-full px-3 py-1 outline-none focus:border-black/50"
                              disabled={busy}
                            />
                            <button
                              onClick={confirmSelected}
                              className="text-xs px-3 py-1 rounded-full border bg-black text-white disabled:opacity-50"
                              disabled={busy || !EMAIL_RE.test((confirmEmail || "").trim())}
                            >
                              Confirm
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {busy && <div className="text-xs text-gray-500 px-2">Typing…</div>}
            </div>

            {/* Input + chips */}
            <div className="bg-white border-t p-2 shrink-0">
              {suggestions.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.value}
                      onClick={async () => {
                        if (s.value === "book a call") {
                          setSuggestions([]);
                          setShowScheduler(true);
                          setShowDayPicker(true);
                          if (!askedDayOnce) {
                            appendBot("Which day works for you? (Times are shown in Eastern Time.)");
                            setAskedDayOnce(true);
                          }
                        } else {
                          void handleSend(s.value);
                        }
                      }}
                      className="text-xs border rounded-full px-3 py-1 hover:bg-black hover:text-white transition"
                      disabled={busy}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  id="replicant-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSend((e.target as HTMLInputElement).value);
                  }}
                  placeholder={
                    email
                      ? "Type your message…"
                      : "Type your message… (or send your email)"
                  }
                  className="flex-1 text-sm border rounded-xl px-3 py-2 outline-none focus:border-black/50 bg-white text-slate-900 placeholder:text-slate-500"
                  aria-label="Message input"
                />
                <button
                  onClick={() => handleSend()}
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
