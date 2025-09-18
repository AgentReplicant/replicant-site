// app/ui/ChatWidget.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

type Msg = { role: "bot" | "user"; text: string; meta?: { link?: string } };
type Hist = { role: "user" | "assistant"; content: string }[];
type Slot = { start: string; end: string; label: string };

const STORE_KEY = "replicant_chat_v10";
const PERSONA_KEY = "replicant_persona_v1";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PHONE_RE = /(\+?\d[\d\-\s().]{7,}\d)/; // loose but practical

type Persona = "alex" | "riley" | "jordan" | "sora";

const INTRO: Record<Persona, string> = {
  alex:
    "Hello — I’m Alex, your Replicant agent. I’m here 24/7 to help, book a quick Google Meet, or get you set up. What would be most helpful?",
  riley:
    "Hey there! I’m Riley with Replicant — your always-on assistant (yep, 24/7). I can answer questions, book time, or get you set up.",
  jordan:
    "Hi, I’m Jordan from Replicant. Let’s move fast: I can answer questions, book a call, or get you set up right away.",
  sora:
    "Hi! I’m Sora with Replicant. I’m available 24/7 — happy to help with questions or book a quick Google Meet.",
};

function pickPersona(): Persona {
  const pool: Persona[] = ["alex", "riley", "jordan", "sora"];
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function ChatWidget() {
  // persona (sticky per browser)
  const [persona, setPersona] = useState<Persona>("alex");

  // UI state
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isTall, setIsTall] = useState(false);

  // Chat state
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [email, setEmail] = useState<string | undefined>();

  // Booking helper state (text-first flow)
  const [candidates, setCandidates] = useState<Slot[] | null>(null); // last suggested 4
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [pendingMode, setPendingMode] = useState<"video" | "phone" | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<Hist>([]);

  /** persona init + greeting */
  useEffect(() => {
    try {
      const saved = (localStorage.getItem(PERSONA_KEY) || "") as Persona;
      const p = saved && ["alex", "riley", "jordan", "sora"].includes(saved) ? (saved as Persona) : pickPersona();
      if (!saved) localStorage.setItem(PERSONA_KEY, p);
      setPersona(p);

      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setMessages(s.messages ?? []);
        setEmail(s.email ?? undefined);
      } else {
        setMessages([{ role: "bot", text: INTRO[p] }]);
      }
    } catch {
      const p = pickPersona();
      setPersona(p);
      setMessages([{ role: "bot", text: INTRO[p] }]);
    }
  }, []);

  /** autoscroll */
  useEffect(() => {
    const el = wrapRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, isTall]);

  /** persist minimal state */
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ messages, email }));
    } catch {}
  }, [messages, email]);

  function appendUser(text: string) {
    setMessages((m) => [...m, { role: "user", text }]);
    historyRef.current.push({ role: "user", content: text });
  }
  function appendBot(text: string, meta?: { link?: string }) {
    setMessages((m) => [...m, { role: "bot", text, meta }]);
    historyRef.current.push({ role: "assistant", content: text });
  }

  async function callBrain(payload: any) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, history: historyRef.current, persona }),
    });
    return res.json();
  }

  function resetPending() {
    setCandidates(null);
    setPendingIndex(null);
    setPendingMode(null);
    setPendingPhone(null);
  }

  async function handleBrainResult(data: any) {
    if (data?.email) setEmail(data.email);

    if (data?.type === "action" && data.action === "open_url" && data.url) {
      appendBot(data.text || "Here’s a secure link:");
      appendBot(`👉 ${data.url}`, { link: data.url });
      resetPending();
      return;
    }

    if (Array.isArray(data?.candidates) && data.candidates.length > 0) {
      setCandidates(data.candidates as Slot[]);
    }

    if (data?.type === "booked") {
      const when = data.when ? ` (${data.when})` : "";
      const meet = data.meetLink ? `\nMeet link: ${data.meetLink}` : "";
      const phoneLine = data.mode === "phone" && data.phone ? `\nPhone: ${data.phone}` : "";
      appendBot(`All set!${when}${meet}${phoneLine}`);
      resetPending();
      return;
    }

    if (data?.type === "text" && data.text) {
      appendBot(data.text);
      return;
    }

    if (data?.text) appendBot(data.text);
  }

  async function handleSend(text?: string) {
    const val = (text ?? input).trim();
    if (!val || busy) return;

    // --- If we’re mid-booking after picking a number ---
    if (pendingIndex !== null) {
      // 1) choose mode if unknown
      if (!pendingMode) {
        const lower = val.toLowerCase();
        if (lower.includes("phone") || PHONE_RE.test(val)) {
          setPendingMode("phone");
          // If they pasted a phone immediately, store it
          if (PHONE_RE.test(val)) setPendingPhone(val.match(PHONE_RE)![0]);
          appendUser(val);
          setInput("");
          appendBot("Got it — phone. What’s the best email for the calendar invite?");
          return;
        }
        if (lower.includes("video") || lower.includes("meet")) {
          setPendingMode("video");
          appendUser(val);
          setInput("");
          appendBot("Great — video (Google Meet). What’s the best email for the invite?");
          return;
        }
        // nudge to choose
        appendUser(val);
        setInput("");
        appendBot("Would you prefer **video** (Google Meet) or **phone**?");
        return;
      }

      // 2) collect phone if mode=phone and missing
      if (pendingMode === "phone" && !pendingPhone && PHONE_RE.test(val)) {
        setPendingPhone(val.match(PHONE_RE)![0]);
        appendUser(val);
        setInput("");
        appendBot("Thanks. What’s the best email for the calendar invite?");
        return;
      }
      if (pendingMode === "phone" && !pendingPhone && !PHONE_RE.test(val)) {
        appendUser(val);
        setInput("");
        appendBot("What number should we call? (You can paste it here.)");
        return;
      }

      // 3) collect email and book
      if (EMAIL_RE.test(val)) {
        setBusy(true);
        appendUser(val);
        setInput("");
        try {
          setEmail(val);
          const chosen = candidates?.[pendingIndex];
          if (!chosen) {
            appendBot("Let’s try that again — say “book a call” and I’ll propose new times.");
            resetPending();
            return;
          }
          const payload: any = {
            pickSlot: {
              start: chosen.start,
              end: chosen.end,
              email: val,
            },
          };
          if (pendingMode) payload.pickSlot.mode = pendingMode;
          if (pendingMode === "phone" && pendingPhone) payload.pickSlot.phone = pendingPhone;

          const booked = await callBrain(payload);
          await handleBrainResult(booked);
        } finally {
          setBusy(false);
        }
        return;
      }

      // If none of the above matched, nudge appropriately
      appendUser(val);
      setInput("");
      if (pendingMode === "phone" && !pendingPhone) {
        appendBot("Please share the phone number we should call.");
      } else {
        appendBot("Please share the best email for the invite.");
      }
      return;
    }

    // --- Start of a booking or normal chat ---
    // If they typed just a number and we have candidates, accept it
    if (/^[1-9]$/.test(val) && candidates && candidates.length > 0) {
      const idx = Number(val) - 1;
      appendUser(val);
      setInput("");
      if (!candidates[idx]) {
        appendBot("That number isn’t in the list. Try again or say “book a call”.");
      } else {
        setPendingIndex(idx);
        appendBot("Would you prefer **video** (Google Meet) or **phone**?");
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

  const suggestions = [
    { label: "Book a call", value: "book a call" },
    { label: "Pricing", value: "how much is it?" },
    { label: "Pay now", value: "pay now" },
  ];

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
            <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
              <div className="font-semibold text-sm text-slate-900">Replicant Assistant</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsTall((v) => !v)} className="text-xs text-gray-500 hover:text-black" aria-label="Toggle height">
                  {isTall ? "Minimize" : "Maximize"}
                </button>
                <button onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-black" aria-label="Close chat">✕</button>
              </div>
            </div>

            <div ref={wrapRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#F8FAFC]">
              {messages.map((m, i) => (
                <div key={i} className={`w-full flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm border break-words ${
                    m.role === "user" ? "bg-black text-white border-black/20" : "bg-white text-black border-gray-200"
                  }`}>
                    <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.text}</div>
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
              {busy && <div className="text-xs text-gray-500 px-2">Typing…</div>}
            </div>

            <div className="bg-white border-t p-2 shrink-0">
              <div className="mb-2 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleSend(s.value)}
                    className="text-xs border rounded-full px-3 py-1 hover:bg-black hover:text-white transition"
                    disabled={busy}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  id="replicant-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSend((e.target as HTMLInputElement).value); }}
                  placeholder="Type your message…"
                  className="flex-1 text-sm border rounded-xl px-3 py-2 outline-none focus:border-black/50 bg-white text-slate-900 placeholder:text-slate-500"
                  aria-label="Message input"
                />
                <button onClick={() => handleSend()} disabled={busy} className="bg-black text-white text-sm px-4 py-2 rounded-xl disabled:opacity-50">
                  Send
                </button>
              </div>

              <div className="text-[10px] text-gray-500 mt-2">
                Under ~$10/day compared to a full-time employee — and available 24/7.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
