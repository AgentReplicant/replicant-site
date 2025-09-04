// app/ui/ChatWidget.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

type Msg = { role: "bot" | "user"; text: string; meta?: { link?: string } };
type Slot = { start: string; end: string; label: string };
type Hist = { role: "user" | "assistant"; content: string }[];

const STORE_KEY = "replicant_chat_v2";

type DateFilter = { y: number; m: number; d: number } | null;

function nextNDays(n=14) {
  const out: Date[] = [];
  const now = new Date();
  for (let i=0;i<n;i++) out.push(new Date(now.getTime()+i*86400000));
  return out;
}
function ymd(d: Date): {y:number,m:number,d:number} {
  return { y: d.getFullYear(), m: d.getMonth()+1, d: d.getDate() };
}
function dayLabel(d: Date) {
  return d.toLocaleDateString("en-US",{ weekday:"short", month:"short", day:"numeric" });
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
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [suggestions, setSuggestions] = useState([
    { label: "See available times", value: "book a call" },
    { label: "Pricing", value: "how much is it?" },
    { label: "Pay now", value: "pay" },
  ]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<Hist>([]);

  // ---- Persistence ----
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
        setShowDayPicker(s.showDayPicker ?? false);
        setSuggestions(s.suggestions ?? suggestions);
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
  }, [messages, busy, slots, showDayPicker]);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ messages, email, slots, date, page, showDayPicker, suggestions }));
    } catch {}
  }, [messages, email, slots, date, page, showDayPicker, suggestions]);

  // ---- helpers ----
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

  async function handleBrainResult(data: any) {
    if (data.type === "ask_day") {
      setSlots(null);
      setShowDayPicker(true);
      if (data.email) setEmail(data.email);
      appendBot(data.text || "Which day works for you?");
      return;
    }

    if (data.type === "action" && data.action === "open_url" && data.url) {
      setSlots(null);
      setSuggestions([{ label: "See available times", value: "book a call" }]);
      appendBot(data.text || "Here’s a secure checkout:");
      appendBot(`👉 ${data.url}`, { link: data.url });
      return;
    }

    if (data.type === "slots" && Array.isArray(data.slots)) {
      if (data.email) setEmail(data.email);
      if (data.date) setDate(data.date);
      setShowDayPicker(false);
      setSlots(data.slots);
      setSuggestions([]); // real options now
      appendBot(data.text || "Pick a time:");
      return;
    }

    if (data.type === "need_email") {
      appendBot(data.text || "What email should I use for the calendar invite?");
      return;
    }

    if (data.type === "booked") {
      setSlots(null);
      setSuggestions([]);
      setShowDayPicker(false);
      const when = data.when ? ` (${data.when})` : "";
      const meet = data.meetLink ? `\nMeet link: ${data.meetLink}` : "";
      appendBot(`All set!${when}${meet}`);
      return;
    }

    if (data.type === "text" && data.text) {
      appendBot(data.text);
      setSuggestions([
        { label: "See available times", value: "book a call" },
        { label: "Pricing", value: "how much is it?" },
        { label: "Pay now", value: "pay" },
      ]);
      return;
    }

    if (data.type === "error") {
      appendBot(data.text || "Something went wrong. Mind trying again?");
      return;
    }

    if (data?.text) appendBot(data.text);
  }

  async function handleSend(text?: string) {
    const val = (text ?? input).trim();
    if (!val || busy) return;

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
    if (!email) {
      appendBot("Great — what’s the best email for the invite?");
      return;
    }
    setBusy(true);
    try {
      const data = await callBrain({ pickSlot: { start: slot.start, end: slot.end, email } });
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

  async function backToDays() {
    setSlots(null);
    setShowDayPicker(true);
    setSuggestions([]);
    appendBot("No problem — choose another day:");
  }

  // ---- UI ----
  const dayButtons = nextNDays(14).map((d) => (
    <button
      key={d.toDateString()}
      onClick={() => chooseDay(d)}
      className={`text-xs border rounded-full px-3 py-1 hover:bg-black hover:text-white transition ${date && d.toDateString() === new Date(date.y, date.m-1, date.d).toDateString() ? "bg-black text-white" : ""}`}
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
          className="fixed bottom-6 right-6 z-[1000] rounded-full shadow-lg px-5 py-3 bg-black text-white text-sm"
          aria-label="Open chat"
        >
          Chat with us
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-[1000] w-[360px] max-w-[92vw] bg-[#F8FAFC] border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
            <div className="font-semibold text-sm">Replicant Assistant</div>
            <button onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-black" aria-label="Close chat">✕</button>
          </div>

          {/* Messages */}
          <div ref={wrapRef} className="h-80 overflow-y-auto p-3 space-y-2 bg-[#F8FAFC]">
            {messages.map((m, i) => (
              <div key={i} className={`w-full flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm border break-words ${m.role === "user" ? "bg-black text-white border-black/20" : "bg-white text-black border-gray-200"}`}>
                  <div>{m.text}</div>
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

            {/* Day picker */}
            {showDayPicker && (
              <div className="mt-3 pt-2 border-t border-gray-200">
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
                    onClick={() => chooseDay(new Date(Date.now()+86400000))}
                    className="text-xs border rounded-full px-3 py-1 hover:bg-black hover:text-white transition"
                    disabled={busy}
                  >
                    Tomorrow
                  </button>
                  {dayButtons}
                </div>
              </div>
            )}

            {/* Slot buttons */}
            {slots && slots.length > 0 && (
              <div className="mt-3 pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-600 mb-1">
                  {date ? `Times for ${new Date(date.y, date.m-1, date.d).toLocaleDateString("en-US",{weekday:"short", month:"short", day:"numeric"})}` : "Quick picks"}:
                </div>
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.start}
                      onClick={() => pickSlot(s)}
                      className="text-xs border rounded-full px-3 py-1 hover:bg-black hover:text-white transition"
                      disabled={busy}
                      title={`${new Date(s.start).toLocaleString("en-US", { timeZone: "America/New_York" })}`}
                    >
                      {s.label}
                    </button>
                  ))}
                  <button onClick={showMoreTimes} className="text-xs border rounded-full px-3 py-1 hover:bg-black hover:text-white transition" disabled={busy}>
                    More times →
                  </button>
                  <button onClick={backToDays} className="text-xs border rounded-full px-3 py-1 hover:bg-black hover:text-white transition" disabled={busy}>
                    ← Change day
                  </button>
                </div>
              </div>
            )}

            {busy && <div className="text-xs text-gray-500 px-2">Typing…</div>}
          </div>

          {/* Input + quick actions */}
          <div className="bg-white border-t p-2">
            {suggestions.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.value}
                    onClick={async () => {
                      if (s.value.toLowerCase().includes("book")) {
                        setSuggestions([]);
                        setShowDayPicker(true);
                        appendUser(s.label);
                        appendBot("Which day works for you?");
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
                  if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (!v) return;
                    if (!email && /@/.test(v)) {
                      appendUser(v);
                      (e.target as HTMLInputElement).value = "";
                      setInput("");
                      void (async () => {
                        const data = await callBrain({ provideEmail: { email: v } });
                        await handleBrainResult(data);
                      })();
                    } else {
                      void handleSend(v);
                    }
                  }
                }}
                placeholder={email ? "Type your message…" : "Type your message… (or send your email)"}
                className="flex-1 text-sm border rounded-xl px-3 py-2 outline-none focus:border-black/50"
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
      )}
    </>
  );
}
