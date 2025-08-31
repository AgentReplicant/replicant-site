"use client";

import React, { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string; meta?: any };
type Slot = { start: string; end: string; label: string };

export default function ChatWidget() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Hey — want to book a demo or pay to get started?" }
  ]);
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [pendingSlots, setPendingSlots] = useState<Slot[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const append = (m: Msg) => setMessages((prev) => [...prev, m]);

  async function callBrain(payload: any) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function handleSend(text?: string) {
    const content = (text ?? inputRef.current?.value ?? "").trim();
    if (!content) return;
    append({ role: "user", text: content });
    inputRef.current && (inputRef.current.value = "");
    setBusy(true);
    try {
      const data = await callBrain({ message: content, history: [] });
      await handleBrainResult(data);
    } finally {
      setBusy(false);
    }
  }

  async function handleBrainResult(data: any) {
    // normalize rendering
    if (data.type === "action" && data.action === "open_url" && data.url) {
      append({ role: "assistant", text: data.text || "Opening payment…" });
      // Render as clickable CTA
      append({
        role: "assistant",
        text: `👉 Pay here: ${data.url}`,
        meta: { link: data.url }
      });
      setPendingSlots(null);
      return;
    }

    if (data.type === "slots" && Array.isArray(data.slots)) {
      if (data.email) setEmail(data.email);
      setPendingSlots(data.slots);
      append({ role: "assistant", text: data.text || "Pick a time:" });
      return;
    }

    if (data.type === "need_email") {
      append({ role: "assistant", text: data.text || "What email should I use?" });
      return;
    }

    if (data.type === "booked") {
      setPendingSlots(null);
      const when = data.when ? ` (${data.when})` : "";
      const meet = data.meetLink ? `\nMeet link: ${data.meetLink}` : "";
      append({ role: "assistant", text: `All set!${when}${meet}` });
      return;
    }

    if (data.type === "text" && data.text) {
      append({ role: "assistant", text: data.text });
      return;
    }

    if (data.type === "error") {
      append({ role: "assistant", text: data.text || "Something went wrong." });
      return;
    }

    // fallback
    if (data?.text) append({ role: "assistant", text: data.text });
  }

  async function pickSlot(slot: Slot) {
    setBusy(true);
    try {
      if (!email) {
        // Ask brain to re-show slots but first collect email
        append({ role: "assistant", text: "Got it. What email should I send the invite to?" });
        // Store the slot temporarily so user can confirm later
        setPendingSlots([slot, ...(pendingSlots?.filter(s => s.start !== slot.start) || [])]);
      } else {
        const data = await callBrain({ pickSlot: { start: slot.start, end: slot.end, email }, history: [] });
        await handleBrainResult(data);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitEmail(raw: string) {
    const e = raw.trim();
    setEmail(e);
    const data = await callBrain({ provideEmail: { email: e }, history: [] });
    await handleBrainResult(data);
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 rounded-2xl shadow-xl border p-3 bg-white/90 backdrop-blur">
      <div className="font-semibold mb-2">Replicant Assistant</div>

      <div className="h-64 overflow-y-auto space-y-2 mb-2 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${m.role === "user" ? "text-right" : "text-left"}`}>
            <div className={`inline-block px-3 py-2 rounded-2xl ${m.role === "user" ? "bg-black text-white" : "bg-gray-100"}`}>
              {m.text}
            </div>
            {m.meta?.link && (
              <div className="mt-1">
                <a className="underline break-all" href={m.meta.link} target="_blank" rel="noreferrer">
                  {m.meta.link}
                </a>
              </div>
            )}
          </div>
        ))}

        {pendingSlots && pendingSlots.length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-gray-600 mb-1">Quick picks:</div>
            <div className="flex flex-wrap gap-2">
              {pendingSlots.map((s) => (
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

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          placeholder={email ? "Type a message…" : "Type a message… (or send your email)"}
          className="flex-1 border rounded-xl px-3 py-2 text-sm"
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              const v = (e.target as HTMLInputElement).value.trim();
              if (!v) return;
              if (!email && /@/.test(v)) {
                append({ role: "user", text: v });
                (e.target as HTMLInputElement).value = "";
                await submitEmail(v);
              } else {
                await handleSend(v);
              }
            }
          }}
        />
        <button
          onClick={() => handleSend()}
          className="text-sm px-3 py-2 rounded-xl bg-black text-white disabled:opacity-50"
          disabled={busy}
        >
          Send
        </button>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        Tips: try <span className="font-mono">book a call</span> or <span className="font-mono">pay</span>.
      </div>
    </div>
  );
}
