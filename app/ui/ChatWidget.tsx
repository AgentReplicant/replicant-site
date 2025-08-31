"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Msg = { role: "agent" | "user"; text: string };

// Make plain URLs clickable, but keep it safe.
function asHtml(text: string) {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const urlRe = /(https?:\/\/[^\s)]+)(?![^<]*>|[^<>]*<\/a>)/g;
  return esc.replace(urlRe, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "agent", text: "Hey — want me to qualify you and book a call?" },
  ]);
  const [input, setInput] = useState("");

  // Public Stripe link for quick “pay” action.
  const payUrl = useMemo(
    () => process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || "",
    []
  );

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const push = (m: Msg) => setMessages((prev) => [...prev, m]);

  // === The "brain" hook-up lives here ===
  const send = async () => {
    const text = input.trim();
    if (!text) return;

    // echo user
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");

    const lower = text.toLowerCase();

    // quick affordances: booking + pay
    if (lower.includes("book") || lower.includes("schedule") || lower.includes("call")) {
      push({
        role: "agent",
        text:
          "I can offer Wed/Thu all day or 4:30–7:30pm other days. " +
          "Or you can pay now to fast-track onboarding.",
      });
      if (payUrl) {
        push({ role: "agent", text: `Pay now: ${payUrl}` });
      }
      return;
    }

    if (lower.includes("pay") || lower.includes("checkout")) {
      if (payUrl) {
        push({
          role: "agent",
          text: `Pay now: ${payUrl}\n\nAfter payment, I’ll send onboarding steps.`,
        });
      } else {
        push({
          role: "agent",
          text: "Payment link isn’t configured yet. Ask me to ‘book a call’ instead.",
        });
      }
      return;
    }

    // Hand off to your backend "brain"
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: text,
          history: messages, // optional, helps the brain keep context
        }),
      });

      const data = await res.json().catch(() => ({}));
      const reply =
        (typeof data?.reply === "string" && data.reply.trim()) ||
        "Got it. You can also try: “book a call” or “pay”.";
      push({ role: "agent", text: reply });
    } catch {
      push({
        role: "agent",
        text: "Hmm, I couldn’t reach the server just now. Try again?",
      });
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 w-80 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur p-3 shadow-xl">
          <div className="mb-2 text-sm text-slate-300">Replicant</div>

          <div ref={listRef} className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                <span
                  className={
                    "inline-block rounded-xl px-3 py-2 text-sm break-words " +
                    (m.role === "user" ? "bg-blue-600" : "bg-white/10 text-slate-100")
                  }
                  dangerouslySetInnerHTML={{ __html: asHtml(m.text) }}
                />
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder='Type here… (try “book a call” or “pay”)'
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
          <path d="M2.25 12c0-4.97 4.38-9 9.75-9s9.75 4.03 9.75 9-4.38 9-9.75 9a10.8 10.8 0 0 1-3.46-.56c-.49.3-1.73.98-3.85 1.64-.34.11-.68-.18-.6-.53.33-1.4.54-2.53.64-3.2A8.9 8.9 0 0 1 2.25 12Z" />
        </svg>
      </button>
    </div>
  );
}
