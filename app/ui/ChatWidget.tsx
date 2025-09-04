// app/ui/ChatWidget.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Msg = { from: "bot" | "user"; text: string; meta?: { link?: string } };
type Slot = { start: string; end: string; label: string };

const PERSONAS = [
  { id: "alex", label: "Alex", tone: "neutral, professional", role: "Sales Agent" },
  { id: "riley", label: "Riley", tone: "friendly, energetic", role: "Sales Agent" },
  { id: "jordan", label: "Jordan", tone: "direct, ROI-driven", role: "Sales Agent" },
  { id: "sora", label: "Sora", tone: "helpful, calm", role: "Support/Booking" },
] as const;

function useRandomPersona(defaultId?: string) {
  const [forced, setForced] = useState<string | undefined>(defaultId);
  const persona = useMemo(() => {
    if (forced) return PERSONAS.find((p) => p.id === forced) ?? PERSONAS[0];
    return PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
  }, [forced]);
  return { persona, setForced };
}

function ChatBubble({ from, text, meta }: { from: "bot" | "user"; text: string; meta?: { link?: string } }) {
  const isUser = from === "user";
  return (
    <div className={`w-full flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-4 py-2 shadow-sm border break-words",
          isUser ? "bg-black text-white border-black/20" : "bg-white text-black border-gray-200",
        ].join(" ")}
      >
        <div>{text}</div>
        {meta?.link && (
          <div className="mt-1">
            <a className="underline break-all" href={meta.link} target="_blank" rel="noreferrer">
              {meta.link}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatWidget({ defaultPersonaId = "alex" }: { defaultPersonaId?: string }) {
  const { persona, setForced } = useRandomPersona(defaultPersonaId);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [suggestions, setSuggestions] = useState([
    { label: "See available times", value: "book a call" },
    { label: "Pay now", value: "pay" },
  ]);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Auto-welcome when opened
  useEffect(() => {
    if (open && messages.length === 0 && persona) {
      setMessages([
        {
          from: "bot",
          text: `Hi, I’m ${persona.label} — Replicant’s ${persona.role}. Want me to book you in or get you set up now?`,
        },
      ]);
      // Ask the brain for default options (so users see slots without magic words)
      void handleSend("hi");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, persona]);

  // Auto-scroll
  useEffect(() => {
    const el = wrapRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, slots]);

  async function callBrain(payload: any) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function handleBrainResult(data: any) {
    if (data.type === "action" && data.action === "open_url" && data.url) {
      setSlots(null);
      setSuggestions([{ label: "See available times", value: "book a call" }]);
      setMessages((m) => [
        ...m,
        { from: "bot", text: data.text || "Opening payment…" },
        { from: "bot", text: `👉 Pay here: ${data.url}`, meta: { link: data.url } },
      ]);
      return;
    }

    if (data.type === "slots" && Array.isArray(data.slots)) {
      if (data.email) setEmail(data.email);
      setSlots(data.slots);
      setSuggestions([]); // we have real options now
      setMessages((m) => [...m, { from: "bot", text: data.text || "Pick a time:" }]);
      return;
    }

    if (data.type === "need_email") {
      setMessages((m) => [...m, { from: "bot", text: data.text || "What email should I use?" }]);
      return;
    }

    if (data.type === "booked") {
      setSlots(null);
      setSuggestions([
        { label: "Book another time", value: "book a call" },
        { label: "Pay now", value: "pay" },
      ]);
      const when = data.when ? ` (${data.when})` : "";
      const meet = data.meetLink ? `\nMeet link: ${data.meetLink}` : "";
      setMessages((m) => [...m, { from: "bot", text: `All set!${when}${meet}` }]);
      return;
    }

    if (data.type === "text" && data.text) {
      setMessages((m) => [...m, { from: "bot", text: data.text }]);
      setSuggestions([
        { label: "See available times", value: "book a call" },
        { label: "Pay now", value: "pay" },
      ]);
      return;
    }

    if (data.type === "error") {
      setMessages((m) => [...m, { from: "bot", text: data.text || "Something went wrong." }]);
      return;
    }

    if (data?.text) setMessages((m) => [...m, { from: "bot", text: data.text }]);
  }

  async function handleSend(text?: string) {
    const val = (text ?? input).trim();
    if (!val || busy) return;

    setMessages((m) => [...m, { from: "user", text: val }]);
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
      setMessages((m) => [...m, { from: "bot", text: "Great — what’s the best email for the invite?" }]);
      // keep chosen slot visible; email will trigger re-show
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

  async function submitEmail(raw: string) {
    const e = raw.trim();
    setEmail(e);
    const data = await callBrain({ provideEmail: { email: e } });
    await handleBrainResult(data);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[1000] rounded-full shadow-lg px-5 py-3 bg-black text-white text-sm"
          aria-label="Open chat"
        >
          Chat with Replicant
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-[1000] w-[360px] max-w-[92vw] bg-[#F8FAFC] border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-white border-b px-4 py-3 flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-black text-white grid place-items-center text-xs">
              {persona?.label.slice(0, 1)}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">
                {persona?.label} • {persona?.role}
              </div>
              <div className="text-[11px] text-gray-500">Tone: {persona?.tone}</div>
            </div>
            <select
              className="text-xs border rounded-md px-2 py-1"
              value={persona?.id}
              onChange={(e) => (setForced as any)(e.target.value)}
              title="Choose persona"
            >
              {PERSONAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <button onClick={() => setOpen(false)} className="ml-2 text-xs text-gray-500 hover:text-black" aria-label="Close chat">
              ✕
            </button>
          </div>

          {/* Messages */}
          <div ref={wrapRef} className="h-80 overflow-y-auto p-3 space-y-2 bg-[#F8FAFC]">
            {messages.map((m, i) => (
              <ChatBubble key={i} from={m.from} text={m.text} meta={m.meta} />
            ))}
            {busy && <div className="text-xs text-gray-500 px-2">Typing…</div>}

            {/* Slot buttons */}
            {slots && slots.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-gray-600 mb-1">Quick picks:</div>
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
                </div>
              </div>
            )}
          </div>

          {/* Input + quick actions */}
          <div className="bg-white border-t p-2">
            {suggestions.length > 0 && (
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
                      setMessages((m) => [...m, { from: "user", text: v }]);
                      (e.target as HTMLInputElement).value = "";
                      setInput("");
                      void submitEmail(v);
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
            <div className="text-[10px] text-gray-500 mt-2">By continuing, you agree to our TOS. Conversations may be logged to improve service.</div>
          </div>
        </div>
      )}
    </>
  );
}
