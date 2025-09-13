'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** ===== Types ===== */
type Role = 'user' | 'bot';
type Message = { id: string; role: Role; text: string };

type Slot = {
  start: string;  // ISO
  end: string;    // ISO
  label: string;  // "Fri 5:00 PM"
  disabled: boolean;
};

const ET_TZ = 'America/New_York';

/** ===== ET helpers ===== */
const toEtNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: ET_TZ }));
const startOfEtDay = (d: Date) =>
  new Date(new Date(d.toLocaleString('en-US', { timeZone: ET_TZ })).setHours(0, 0, 0, 0));

const weekdayMap: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const weekdayLabel = (i: number) =>
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i];

const nextEtWeekday = (dow: number) => {
  const now = toEtNow();
  const delta = (dow + 7 - now.getDay()) % 7;
  const d = new Date(now);
  d.setDate(now.getDate() + delta);
  return d;
};

/** ===== Build /api/slots URL ===== */
function buildSlotsUrl(opts: { date?: Date; page?: number; limit?: number }) {
  const url = new URL('/api/slots', window.location.origin);
  if (opts.date) {
    const d = startOfEtDay(opts.date);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    url.searchParams.set('y', String(y));
    url.searchParams.set('m', String(m).padStart(2, '0'));
    url.searchParams.set('d', String(day).padStart(2, '0'));
  } else {
    // fallback quick picks
    url.searchParams.set('days', '1');
  }
  url.searchParams.set('limit', String(opts.limit ?? 6));
  url.searchParams.set('page', String(opts.page ?? 0));
  url.searchParams.set('tz', ET_TZ);
  return url.toString();
}

/** ===== Component ===== */
export default function ChatWidget() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: 'Hey — I can answer questions, book a quick Zoom, or get you set up now.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  // Scheduler state
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedDate, setSchedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [email, setEmail] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  /** ===== Util ===== */
  const pushBot = useCallback((text: string) => {
    setMessages(ms => [...ms, { id: `m${Date.now()}`, role: 'bot', text }]);
  }, []);
  const pushUser = useCallback((text: string) => {
    setMessages(ms => [...ms, { id: `m${Date.now()}`, role: 'user', text }]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, schedOpen, slots, selected]);

  /** ===== Slots loader ===== */
  const loadSlots = useCallback(
    async ({ reset }: { reset: boolean }) => {
      const currentPage = reset ? 0 : page;
      const url = buildSlotsUrl({ date: schedDate ?? undefined, page: currentPage, limit: 6 });
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load slots');
      const data = await res.json() as { slots: Slot[] };
      setSlots(s => (reset ? data.slots : [...s, ...data.slots]));
      if (reset) setPage(0);
    },
    [schedDate, page]
  );

  /** ===== Day token handler (today / tomorrow / weekday) ===== */
  const handleDateToken = useCallback(async (token: string) => {
    const t = token.trim().toLowerCase();

    if (t === 'today') {
      setSchedDate(startOfEtDay(toEtNow()));
      setSchedOpen(true);
      setSelected(null);
      await loadSlots({ reset: true });
      return true;
    }

    if (t === 'tomorrow') {
      const d = toEtNow(); d.setDate(d.getDate() + 1);
      setSchedDate(startOfEtDay(d));
      setSchedOpen(true);
      setSelected(null);
      await loadSlots({ reset: true });
      return true;
    }

    if (weekdayMap[t] !== undefined) {
      const d = nextEtWeekday(weekdayMap[t]);
      setSchedDate(startOfEtDay(d));
      setSchedOpen(true);
      setSelected(null);
      await loadSlots({ reset: true });
      return true;
    }

    return false;
  }, [loadSlots]);

  /** ===== Send handler ===== */
  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    pushUser(text);

    // If user typed a day token, open scheduler for that day
    setBusy(true);
    try {
      const handled = await handleDateToken(text);
      if (handled) {
        pushBot('Pick a time that works (ET):');
        return;
      }

      // Otherwise, default behavior: open quick picks for the next available day
      setSchedDate(null);
      setSchedOpen(true);
      setSelected(null);
      await loadSlots({ reset: true });
      pushBot('Pick a time that works (ET):');
    } finally {
      setBusy(false);
    }
  }, [input, pushUser, handleDateToken, loadSlots, pushBot]);

  /** ===== Confirm booking ===== */
  const confirm = useCallback(async () => {
    if (!selected || !email) return;
    setBusy(true);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          start: selected.start,
          end: selected.end,
          tz: ET_TZ,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        pushBot('Could not book that slot (That time was just taken). Please pick another.');
        // Re-open and reload the same day to show updated availability
        await loadSlots({ reset: true });
        setSelected(null);
        return;
      }

      // Success: close card, clear state, and post confirmation message
      setSchedOpen(false);
      setSlots([]);
      setSelected(null);
      setEmail('');
      pushBot(`All set! (${new Date(selected.start).toLocaleString('en-US', { timeZone: ET_TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}) Meet link: ${data?.htmlLink ?? data?.meetLink ?? '(check your email)'}\nAn invite will be sent to ${email}`);
    } catch {
      pushBot('Sorry—something went wrong. Mind trying another time?');
    } finally {
      setBusy(false);
    }
  }, [selected, email, pushBot, loadSlots]);

  /** ===== UI bits ===== */
  const dayButtons = useMemo(() => {
    return [...Array(7)].map((_, i) => {
      const d = nextEtWeekday(i);
      const lbl = weekdayLabel(i);
      const isActive =
        schedDate && startOfEtDay(d).getTime() === startOfEtDay(schedDate).getTime();
      return (
        <button
          key={i}
          className={`px-3 py-1 rounded-full border text-sm ${
            isActive ? 'bg-black text-white' : 'bg-white text-black'
          }`}
          onClick={async () => {
            setSchedDate(startOfEtDay(d));
            setSelected(null);
            await loadSlots({ reset: true });
          }}
        >
          {lbl}
        </button>
      );
    });
  }, [schedDate, loadSlots]);

  return (
    <div className="w-full max-w-sm mx-auto border rounded-2xl shadow-md overflow-hidden flex flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="h-[420px] overflow-y-auto p-3 space-y-2 bg-white">
        {messages.map(m => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-5 ${
              m.role === 'user'
                ? 'bg-black text-white ml-auto'
                : 'bg-gray-100 text-gray-900'
            }`}
          >
            {m.text}
          </div>
        ))}

        {/* Scheduler card */}
        {schedOpen && (
          <div className="border rounded-xl p-3 mt-2 bg-white">
            <div className="flex items-center justify-between text-sm font-medium mb-1">
              <div>Scheduling</div>
              <div className="space-x-3">
                <button
                  className="underline"
                  onClick={() => setSchedOpen(false)}
                >
                  Hide
                </button>
                <button
                  className="underline"
                  onClick={async () => {
                    setSchedDate(null);
                    setSelected(null);
                    await loadSlots({ reset: true });
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Day strip */}
            <div className="mt-1 flex flex-wrap gap-1.5">{dayButtons}</div>

            {/* Slots */}
            <div className="mt-3">
              <div className="text-[11px] text-gray-500 mb-2">
                All times shown in Eastern Time (ET).
              </div>
              {slots.length === 0 ? (
                <div className="text-sm text-gray-500">No times to show.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((s, idx) => {
                    const isSelected = selected?.start === s.start && selected?.end === s.end;
                    const base =
                      'px-3 py-1 rounded-full border text-sm transition';
                    const enabledCls = isSelected
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black hover:bg-gray-50';
                    const disabledCls = 'bg-gray-100 text-gray-400 line-through cursor-not-allowed';
                    return (
                      <button
                        key={`${s.start}-${idx}`}
                        disabled={s.disabled}
                        aria-disabled={s.disabled}
                        onClick={() => !s.disabled && setSelected(s)}
                        className={`${base} ${s.disabled ? disabledCls : enabledCls}`}
                        title={s.disabled ? 'Unavailable' : 'Available'}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Footer controls */}
              <div className="mt-3 flex gap-2">
                <button
                  className="px-3 py-1 rounded-full border text-sm"
                  onClick={async () => {
                    setPage(p => p + 1);
                    await loadSlots({ reset: false });
                  }}
                >
                  More times →
                </button>
                <button
                  className="px-3 py-1 rounded-full border text-sm"
                  onClick={async () => {
                    // Jump to tomorrow (relative), but keep the day strip for precise choice
                    const d = toEtNow(); d.setDate(d.getDate() + 1);
                    setSchedDate(startOfEtDay(d));
                    setSelected(null);
                    await loadSlots({ reset: true });
                  }}
                >
                  ← Change day
                </button>
              </div>

              {/* Inline confirm bar */}
              {selected && (
                <div className="mt-3 border-t pt-3 flex items-center gap-2 flex-wrap">
                  <div className="text-sm">
                    <span className="font-medium">Selected:</span>{' '}
                    {new Date(selected.start).toLocaleString('en-US', {
                      timeZone: ET_TZ,
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                  <button
                    className="text-sm underline"
                    onClick={() => setSelected(null)}
                  >
                    Change time
                  </button>

                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your email to confirm"
                    className="ml-auto flex-1 min-w-[180px] border rounded-lg px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-black/20"
                  />
                  <button
                    onClick={confirm}
                    disabled={!email || busy}
                    className="px-3 py-1 rounded-lg text-sm bg-black text-white disabled:opacity-50"
                  >
                    Confirm
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t p-2 flex gap-2 items-center">
        <input
          id="replicant-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          className="flex-1 text-sm border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-black/20"
          placeholder="Type your message… (or send your email)"
          aria-label="Message input"
        />
        <button
          onClick={handleSend}
          disabled={busy}
          className="bg-black text-white text-sm px-4 py-2 rounded-xl disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
