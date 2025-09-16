// app/ui/ChatWidget.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

type Msg = { role: "bot" | "user"; text: string; meta?: { link?: string } };
type Hist = { role: "user" | "assistant"; content: string }[];
type Slot = { start: string; end: string; label: string };

const STORE_KEY = "replicant_chat_v10";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isTall, setIsTall] = useState(false);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [email, setEmail] = useState<string | undefined>();

  // minimal client-side memory so chat can book with “1/2/3”
  const [candidates, setCandidates] = useState<Slot[] | null>(null);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<Hist>([]);

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setMessages(s.messages ?? []);
        setEmail(s.email ?? undefined);
      } else {
        setMessages([{ role: "bot", text: "Hey — I can answer questions, book a quick Zoom, or get you set up now." }]);
      }
    } catch {
      setMessages([{ role: "bot", text: "Hey — I can answer questions, book a quick Zoom, or get you set up now." }]);
    }
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, isTall]);

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
      body: JSON.stringify({ ...payload, history: historyRef.current }),
    });
    return res.json();
  }

  async function handleBrainResult(data: any) {
    if (data?.email) setEmail(data.email);

    // link / checkout
    if (data?.type === "action" && data.action === "open_url" && data.url) {
      appendBot(data.text || "Here’s a secure link:");
      appendBot(`👉 ${data.url}`, { link: data.url });
      setCandidates(null);
      setPendingIndex(null);
      return;
    }

    if (Array.isArray(data?.candidates) && data.candidates.length > 0) {
      // store the current choices (for 1/2/3 flow)
      setCandidates(data.candidates as Slot[]);
    }

    if (data?.type === "booked") {
      const when = data.when ? ` (${data.when})` : "";
      const meet = data.meetLink ? `\nMeet link: ${data.meetLink}` : "";
      appendBot(`All set!${when}${meet}`);
      setCandidates(null);
      setPendingIndex(null);
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

    // If user is replying with email for a pending numeric selection
    if (pendingIndex !== null && EMAIL_RE.test(val)) {
      setBusy(true);
      appendUser(val);
      setInput("");
      try {
        const chosen = candidates?.[pendingIndex];
        if (chosen) {
          setEmail(val);
          const booked = await callBrain({ pickSlot: { start: chosen.start, end: chosen.end, email: val } });
          await handleBrainResult(booked);
        } else {
          appendBot("Let’s try that again. Say “book a call” and I’ll propose new times.");
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    // If user typed “1/2/3” and we have choices
    if (/^[1-9]$/.test(val) && candidates && candidates.length > 0) {
      const idx = Number(val) - 1;
      if (!candidates[idx]) {
        appendUser(val);
        setInput("");
        appendBot("That number isn’t in the list. Try again or say “book a call”.");
        return;
      }

      // If we already know their email, book immediately. Otherwise, ask.
      appendUser(val);
      setInput("");
      if (email) {
        setBusy(true);
        try {
          const booked = await callBrain({ pickSlot: { start: candidates[idx].start, end: candidates[idx].end, email } });
          await handleBrainResult(booked);
        } finally {
          setBusy(false);
        }
      } else {
        setPendingIndex(idx);
        appendBot("What’s the best email for the invite?");
      }
      return;
    }

    // Regular chat
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
                By continuing, you agree to our TOS. Conversations may be logged to improve service.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
