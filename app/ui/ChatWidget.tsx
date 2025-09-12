// app/ui/ChatWidget.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

type Msg = { role: "bot" | "user"; text: string; meta?: { link?: string } };
type Slot = { start: string; end: string; label: string };
type Hist = { role: "user" | "assistant"; content: string }[];

const STORE_KEY = "replicant_chat_v8";
const CID_KEY = "replicant_client_id";
type DateFilter = { y: number; m: number; d: number } | null;

function nextNDays(n = 14) {
  const out: Date[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) out.push(new Date(now.getTime() + i * 86400000));
  return out;
}
function ymd(d: Date) {
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}
function dayLabel(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// preference sniff (client-side hint only)
function inferTimePrefFromLastUser(history: Hist): "morning" | "afternoon" | "evening" | "night" | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== "user") continue;
    const t = history[i].content.toLowerCase();
    if (/\b(morning|am)\b/.test(t)) return "morning";
    if (/\b(afternoon)\b/.test(t)) return "afternoon";
    if (/\b(evening)\b/.test(t)) return "evening";
    if (/\b(tonight|night)\b/.test(t)) return "night";
    break;
  }
  return null;
}
function filterSlotsByPref(slots: Slot[], pref: ReturnType<typeof inferTimePrefFromLastUser>) {
  if (!pref) return slots;
  const hour = (s: Slot) => {
    const m = s.label.match(/\b(\d{1,2}):?(\d{2})?\s?(AM|PM)\b/i);
    if (m) {
      let h = parseInt(m[1], 10);
      const ampm = m[3].toUpperCase();
      if (ampm === "PM" && h !== 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      return h;
    }
    return new Date(s.start).getUTCHours();
  };
  switch (pref) {
    case "morning": return slots.filter((s) => hour(s) < 12);
    case "afternoon": return slots.filter((s) => hour(s) >= 12 && hour(s) < 17);
    case "evening": return slots.filter((s) => hour(s) >= 17 && hour(s) <= 21);
    case "night": return slots.filter((s) => hour(s) >= 19);
    default: return slots;
  }
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [email, setEmail] = useState<string | undefined>();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [date, setDate] = useState<DateFilter>(null);
  const [page, setPage] = useState(0);
  const [showScheduler, setShowScheduler] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [isTall, setIsTall] = useState(false);
  const [askedDayOnce, setAskedDayOnce] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<Slot | null>(null); // selected, waiting confirm/email
  const [suggestions, setSuggestions] = useState([
    { label: "Pick a day", value: "book a call" },
    { label: "Keep explaining", value: "please keep explaining" },
    { label: "Pricing", value: "how much is it?" },
    { label: "Pay now", value: "pay now" },
  ]);

  const [promptedPickTime, setPromptedPickTime] = useState(false);
  const [bookingAfterEmail, setBookingAfterEmail] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<Hist>([]);
  const clientIdRef = useRef<string>("");

  // init & clientId
  useEffect(() => {
    try {
      const fromLS = localStorage.getItem(CID_KEY);
      if (fromLS) {
        clientIdRef.current = fromLS;
      } else {
        const cid = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        clientIdRef.current = cid;
        localStorage.setItem(CID_KEY, cid);
      }
      // also set a cookie so the server can read it if it prefers cookies
      document.cookie = `replicant_cid=${clientIdRef.current}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {}

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setMessages(s.messages ?? []);
        setEmail(s.email ?? undefined);
        setSlots(s.slots ?? null);
        setDate(s.date ?? null);
        setPage(s.page ?? 0);
        setShowScheduler(s.showScheduler ?? false);
        setShowDayPicker(s.showDayPicker ?? false);
        setIsTall(s.isTall ?? false);
        setAskedDayOnce(s.askedDayOnce ?? false);
        setPendingSlot(s.pendingSlot ?? null);
        setSuggestions(s.suggestions ?? suggestions);
        setPromptedPickTime(s.promptedPickTime ?? false);
      } else {
        setMessages([{ role: "bot", text: "Hey — I can answer questions, book a quick Zoom, or get you set up now." }]);
      }
    } catch {
      setMessages([{ role: "bot", text: "Hey — I can answer questions, book a quick Zoom, or get you set up now." }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, slots, showDayPicker, showScheduler, isTall]);

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
          pendingSlot,
          suggestions,
          promptedPickTime,
        })
      );
    } catch {}
  }, [messages, email, slots, date, page, showScheduler, showDayPicker, isTall, askedDayOnce, pendingSlot, suggestions, promptedPickTime]);

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
    const cid = clientIdRef.current;
    const body = JSON.stringify({ ...payload, history: historyRef.current, filters, clientId: cid });
    const res = await fetch(`/api/chat?cid=${encodeURIComponent(cid)}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-client-id": cid },
      body,
    });
    return res.json();
  }

  async function handleBrainResult(data: any) {
    if (data?.email) setEmail(data.email);

    if (data?.type === "need_email") {
      if (data.start && data.end) setPendingSlot({ start: data.start, end: data.end, label: data.when || "selected time" });
      appendBot(data.text || "What email should I use for the calendar invite?");
      return;
    }

    if (data?.type === "action" && data.action === "open_url" && data.url) {
      setSlots(null);
      setShowScheduler(false);
      setShowDayPicker(false);
      setSuggestions([
        { label: "Pick a day", value: "book a call" },
        { label: "Keep explaining", value: "please keep explaining" },
      ]);
      setPromptedPickTime(false);
      appendBot(data.text || "Here’s a secure checkout:");
      appendBot(`👉 ${data.url}`, { link: data.url });
      return;
    }

    if (data?.type === "slots" && Array.isArray(data.slots)) {
      if (bookingAfterEmail) return; // suppress slot nudges mid auto-book
      if (data.date) setDate(data.date);
      setPendingSlot(null); // new results invalidate old selection

      const pref = inferTimePrefFromLastUser(historyRef.current);
      const pruned = filterSlotsByPref(data.slots, pref);

      setShowScheduler(true);
      setShowDayPicker(false);
      setSlots(pruned);
      setSuggestions([]);

      if (!promptedPickTime) {
        appendBot(data.text || "Pick a time that works (ET):");
        setPromptedPickTime(true);
      }
      return;
    }

    if (data?.type === "booked") {
      setSlots(null);
      setShowScheduler(false);
      setShowDayPicker(false);
      setSuggestions([]);
      setPendingSlot(null);
      setPromptedPickTime(false);
      const when = data.when ? ` (${data.when})` : "";
      const meet = data.meetLink ? `\nMeet link: ${data.meetLink}` : "";
      appendBot(`All set!${when}${meet}`);
      return;
    }

    if (data?.type === "error") {
      setSlots(null);
      setShowScheduler(false);
      setShowDayPicker(false);
      setPendingSlot(null);
      setPromptedPickTime(false);
      appendBot(data.text || "Something went wrong. Mind trying another time?");
      return;
    }

    if (data?.type === "text" && data.text) {
      // Override any phone-number requests to keep email-first flow
      if (/phone\s*(number)?/i.test(data.text)) {
        if (pendingSlot) setShowScheduler(false);
        appendBot("Great — what’s the best email for the invite?");
        return;
      }
      if (bookingAfterEmail && /pick a time/i.test(data.text)) {
        // ignore noisy nudges while auto-booking
      } else {
        appendBot(data.text);
      }
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

  // send

  async function handleSend(text?: string) {
    const val = (text ?? input).trim();
    if (!val || busy) return;

    // User typed an email → store & (if pending slot) auto-book
    if (!email && /@/.test(val)) {
      appendUser(val);
      setInput("");
      setBusy(true);
      try {
        const saved = await callBrain({ provideEmail: { email: val } });

        if (pendingSlot) {
          setBookingAfterEmail(true);
          if (saved?.email) setEmail(saved.email);
          const booked = await callBrain({ pickSlot: { start: pendingSlot.start, end: pendingSlot.end, email: val } });
          await handleBrainResult(booked);
        } else {
          await handleBrainResult(saved);
        }
      } finally {
        setBookingAfterEmail(false);
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
    // Selection → ask to confirm
    if (!email) {
      setPendingSlot(slot);
      return; // UI shows confirm/change bar
    }
    // Already have email → book now
    setBusy(true);
    try {
      const data = await callBrain({ pickSlot: { start: slot.start, end: slot.end, email } });
      await handleBrainResult(data);
    } finally {
      setBusy(false);
    }
  }

  async function confirmPending() {
    if (!pendingSlot) return;
    if (!email) {
      setShowScheduler(false); // hide grid while waiting for email
      appendBot("Great — what’s the best email for the invite?");
      return;
    }
    await pickSlot(pendingSlot);
  }

  function changeTime() {
    setPendingSlot(null); // re-enable grid
  }

  async function chooseDay(d: Date) {
    const { y, m, d: dd } = ymd(d);
    setDate({ y, m, d: dd });
    setPage(0);
    setBusy(true);
    setPromptedPickTime(false);
    setPendingSlot(null);
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

  function resetSchedulingUI() {
    setSlots(null);
    setShowDayPicker(false);
    setShowScheduler(false);
    setPage(0);
    setAskedDayOnce(false);
    setPendingSlot(null);
    setPromptedPickTime(false);
    setSuggestions([
      { label: "Pick a day", value: "book a call" },
      { label: "Keep explaining", value: "please keep explaining" },
    ]);
  }

  const dayButtons = nextNDays(14).map((d) => (
    <button
      key={d.toDateString()}
      onClick={() => chooseDay(d)}
      className={`text-xs border rounded-full px-3 py-1 hover:bg-black hover:text-white transition ${
        date && d.toDateString() === new Date(date.y, date.m - 1, date.d).toDateString() ? "bg-black text-white" : ""
      }`}
      disabled={busy}
      title={d.toLocaleDateString()}
    >
      {dayLabel(d)}
    </button>
  ));

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
                <button onClick={() => setIsTall((v) => !v)} className="text-xs text-gray-500 hover:text-black" aria-label="Toggle height">
                  {isTall ? "Minimize" : "Maximize"}
                </button>
                <button onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-black" aria-label="Close chat">
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
                      m.role === "user" ? "bg-black text-white border-black/20" : "bg-white text-black border-gray-200"
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
                          onClick={() => chooseDay(new Date(Date.now() + 86400000))}
                          className="text-xs border rounded-full px-3 py-1 hover:bg-black hover:text-white transition"
                          disabled={busy}
                        >
                          Tomorrow
                        </button>
                        {dayButtons}
                      </div>
                    </div>
                  )}

                  {slots && slots.length > 0 && (
                    <div className="px-3 py-2 border-t">
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
                        {slots.map((s) => {
                          const selected = pendingSlot?.start === s.start && pendingSlot?.end === s.end;
                          return (
                            <button
                              key={s.start}
                              onClick={() => pickSlot(s)}
                              className={`text-xs border rounded-full px-3 py-1 transition ${
                                selected ? "bg-black text-white" : "hover:bg-black hover:text-white"
                              }`}
                              disabled={busy || !!pendingSlot}
                              title={s.label}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                        <button
                          onClick={showMoreTimes}
                          className="text-xs border rounded-full px-3 py-1 hover:bg-black hover:text-white transition"
                          disabled={busy || !!pendingSlot}
                        >
                          More times →
                        </button>
                        <button
                          onClick={() => setShowDayPicker(true)}
                          className="text-xs border rounded-full px-3 py-1 hover:bg-black hover:text-white transition"
                          disabled={busy || !!pendingSlot}
                        >
                          ← Change day
                        </button>
                      </div>

                      {/* Confirm bar */}
                      {pendingSlot && (
                        <div className="mt-3 p-2 border-t text-xs flex items-center justify-between">
                          <div>You picked <span className="font-medium">{pendingSlot.label}</span>.</div>
                          <div className="flex gap-2">
                            <button
                              onClick={confirmPending}
                              className="text-xs px-3 py-1 rounded-full bg-black text-white disabled:opacity-60"
                              disabled={busy}
                            >
                              Confirm
                            </button>
                            <button onClick={changeTime} className="text-xs underline" disabled={busy}>
                              Change time
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
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSend((e.target as HTMLInputElement).value);
                  }}
                  placeholder={email ? "Type your message…" : "Type your message… (or send your email)"}
                  className="flex-1 text-sm border rounded-xl px-3 py-2 outline-none focus:border-black/50 bg-white text-slate-900 placeholder:text-slate-500"
                  aria-label="Message input"
                />
                <button onClick={() => handleSend()} disabled={busy} className="bg-black text-white text-sm px-4 py-2 rounded-xl disabled:opacity-50">
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
