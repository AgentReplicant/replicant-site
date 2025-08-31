"use client";

import { useMemo, useState } from "react";

type Msg = { role: "agent" | "user"; text: string };

const PAY_URL =
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || "https://example.com/pay";

/** Turn URLs in plain text into clickable <a> elements */
function linkify(text: string) {
  const urlRE =
    /(https?:\/\/[^\s)]+|www\.[^\s)]+)/gi; // crude but effective for chat
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRE.exec(text)) !== null) {
    const [raw] = match;
    const start = match.index;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));

    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    parts.push(
      <a
        key={`${href}-${start}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:opacity-90"
      >
        {raw}
      </a>
    );
    lastIndex = start + raw.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "agent", text: "Hey — want me to qualify you and book a call?" },
  ]);
  const [input, setInput] = useState("");

  const send = () => {
    const text = input.trim();
    if (!text) return;

    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");

    const lower = text.toLowerCase();

    if (lower.includes("pay")) {
      setMessages((m) => [
        ...m,
        { role: "agent", text: `Here you go: ${PAY_URL}` },
      ]);
      return;
    }

    if (lower.includes("book") || lower.includes("call")) {
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text:
            "I can offer Wed/Thu all day or 4:30–7:30pm other days. Or you can pay now to fast-track onboarding.",
        },
        { role: "agent", text: `Pay now: ${PAY_URL}` },
      ]);
      return;
    }

    setMessages((m) => [
      ...m,
      {
        role: "agent",
        text:
          "Got it. Ask me to 'book a call' to see scheduling, or type 'pay' for checkout.",
      },
    ]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 w-80 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur p-3 shadow-xl">
          <div className="mb-2 text-sm text-slate-300">Replicant</div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "text-right" : "text-left"}
              >
                <span
                  className={[
                    "inline-block rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                    m.role === "user" ? "bg-blue-600" : "bg-white/10 text-slate-100",
                  ].join(" ")}
                >
                  {linkify(m.text)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type here…"
              className="flex-1 rounded-xl bg-black/40 px-3 py-2 text-sm outline-none border border-white/10"
            />
            <button
              onClick={send}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-2 text-sm font-medium"
            >
              Send
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full bg-blue-600 hover:bg-blue-700 w-14 h-14 grid place-items-center shadow-lg"
        aria-label="Open chat"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-6 h-6"
        >
          <path d="M2.25 12c0-4.97 4.38-9 9.75-9s9.75 4.03 9.75 9-4.38 9-9.75 9a10.8 10.8 0 01-3.46-.56c-.49.3-1.73.98-3.85 1.64-.34.11-.68-.18-.6-.53.33-1.4.54-2.53.64-3.2A8.9 8.9 0 012.25 12Z" />
        </svg>
      </button>
    </div>
  );
}
