// app/api/chat/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

type Role = "user" | "assistant" | "system";
type Msg = { role: Role; content: string };

const STRIPE_URL = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || "";
const BOOKING_TZ = process.env.BOOKING_TZ || "America/New_York";
const BOOKING_RULES_JSON =
  process.env.BOOKING_RULES_JSON ||
  `{"hours":{"mon":[["16:30","19:30"]],"tue":[["16:30","19:30"]],"wed":[["09:00","19:30"]],"thu":[["09:00","19:30"]],"fri":[["16:30","19:30"]],"sat":[["16:30","19:30"]],"sun":[["16:30","19:30"]]},"slotIntervalMins":30,"meetingLengthMins":30,"stacking":true,"bufferBeforeMins":5,"bufferAfterMins":5}`;
const SCHEDULE_API_PATH = "/api/schedule";
const LLM_ENABLED = !!process.env.LLM_ENABLED && !!process.env.OPENAI_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

/* ---------- tz-safe slot builder (honors your hours) ---------- */
function tzNow() { return new Date(new Date().toLocaleString("en-US", { timeZone: BOOKING_TZ })); }
function zonedISO(y:number,m:number,d:number,h:number,min:number) {
  const guessUTC = Date.UTC(y, m-1, d, h, min, 0);
  const asTz = new Date(guessUTC).toLocaleString("en-US", { timeZone: BOOKING_TZ });
  const asLocal = new Date(asTz);
  const diff = asLocal.getTime() - guessUTC;
  return new Date(guessUTC - diff).toISOString();
}
function fmtET(iso: string) {
  return new Date(iso).toLocaleString("en-US", { timeZone: BOOKING_TZ, weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit" });
}
function parseRules() {
  try { return JSON.parse(BOOKING_RULES_JSON); }
  catch { return { hours:{ mon:[["09:00","17:00"]], tue:[["09:00","17:00"]], wed:[["09:00","17:00"]], thu:[["09:00","17:00"]], fri:[["09:00","17:00"]] }, slotIntervalMins:30, meetingLengthMins:30, bufferBeforeMins:0, bufferAfterMins:0, stacking:true }; }
}
function hhmm(str:string){ const [hh,mm]=str.split(":").map(n=>parseInt(n,10)); return {hh,mm}; }
const wkMap = ["sun","mon","tue","wed","thu","fri","sat"] as const;
function slotsForDate(y:number,m:number,d:number,page=0){
  const rules = parseRules();
  const { slotIntervalMins=30, meetingLengthMins=30, bufferBeforeMins=0 } = rules;
  const now = tzNow(); const pageSize=5;
  const key = wkMap[new Date(y, m-1, d).getDay()];
  const windows: [string,string][]=rules?.hours?.[key]||[];
  const out: {start:string; end:string; label:string}[]=[];
  for (const [s,e] of windows){
    const {hh:sh,mm:sm}=hhmm(s), {hh:eh,mm:em}=hhmm(e);
    for (let t=sh*60+sm; t+meetingLengthMins<=eh*60+em; t+=slotIntervalMins){
      const start = zonedISO(y,m,d, Math.floor(t/60), t%60);
      const end   = zonedISO(y,m,d, Math.floor((t+meetingLengthMins)/60), (t+meetingLengthMins)%60);
      const leadMs = (30+bufferBeforeMins)*60_000;
      if (new Date(start).getTime()-now.getTime()<leadMs) continue;
      out.push({ start, end, label: fmtET(start) });
    }
  }
  const startIdx = page*pageSize;
  return { slots: out.slice(startIdx, startIdx+pageSize), total: out.length, meetingLengthMins };
}

/* ---------- parsing & intent ---------- */
function extractEmail(t:string){ const m=(t||"").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i); return m?m[0]:null; }
function latestEmail(h?:Msg[]){ if(!h) return null; for(let i=h.length-1;i>=0;i--){ const e=extractEmail(h[i].content); if(e) return e; } return null; }
function parseDay(msg:string){ const m=(msg||"").toLowerCase(); const days=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"], abbr=["sun","mon","tue","wed","thu","fri","sat"]; const now=tzNow();
  if(/\btoday\b/.test(m)) return { y:now.getFullYear(), m:now.getMonth()+1, d:now.getDate() };
  if(/\btomorrow\b/.test(m)){ const t=new Date(now.getTime()+86400000); return { y:t.getFullYear(), m:t.getMonth()+1, d:t.getDate() }; }
  let want:number|null=null; for(let i=0;i<7;i++){ if(m.includes(days[i])||m.match(new RegExp(`\\b${abbr[i]}\\b`))){ want=i; break; } }
  if(want===null) return null; for(let add=1;add<=21;add++){ const c=new Date(now.getTime()+add*86400000); if(c.getDay()===want) return { y:c.getFullYear(), m:c.getMonth()+1, d:c.getDate() }; }
  return null;
}
function parseTime(msg:string){ const m=(msg||"").toLowerCase(); const r=/(?:\b|@)(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/; const a=m.match(r); if(!a) return null; let h=parseInt(a[1],10), min=a[2]?parseInt(a[2],10):0, ap=a[3]; if(ap==="pm"&&h<12) h+=12; if(ap==="am"&&h===12) h=0; return {h,min}; }
function detectIntent(message:string){
  const m=(message||"").toLowerCase();
  const hasDay=!!parseDay(message), hasTime=!!parseTime(message);
  if(hasDay&&hasTime) return "book_exact";
  if(/can\s+i\s+book/.test(m)&&(hasDay||hasTime)) return "book_exact";
  if(/\b(price|pricing|cost|how much|monthly|per month)\b/.test(m)) return "pricing";
  if(/(can|could|able to).*\bbook\b/.test(m)) return "capability";
  if(/(whatsapp|instagram).*appoint|auto.*book|automatic.*appoint|from instagram|from whatsapp/.test(m)) return "capability";
  if(/\b(pay now|pay\b|checkout|sign ?up|subscribe|buy)\b/.test(m)) return "pay";
  if(/\b(see (available )?times?|pick a time|book (a )?(call|meeting|demo)|schedule (a )?(call|meeting|demo))\b/.test(m)) return "book";
  if(hasDay) return "book";
  if(/(email is|my email is|@)/.test(m)) return "email";
  return "unknown";
}

/* ---------- booking helpers ---------- */
async function tryBookExact(origin:string, date:{y:number;m:number;d:number}, hm:{h:number;min:number}, email?:string){
  const { meetingLengthMins=30 } = parseRules();
  const start = zonedISO(date.y,date.m,date.d, hm.h,hm.min);
  const end   = zonedISO(date.y,date.m,date.d, hm.h,hm.min+meetingLengthMins);
  if(!email) return { needEmail:true, start, end, label: fmtET(start) };
  const url = `${origin}${SCHEDULE_API_PATH}`;
  const res = await fetch(url,{ method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ start, end, email }), cache:"no-store" });
  let data:any = null; try{ data = await res.json(); }catch{}
  if(!res.ok){
    const msg = data?.error || data?.message || `schedule returned ${res.status}`;
    return { error:true, message: msg };
  }
  return { booked:true, start, end, meetLink:data?.meetLink, label: fmtET(start) };
}

/* ---------- LLM (answer-first; never say can't book) ---------- */
async function llmPlanReply(user:string, history:Msg[]|undefined){
  if(!LLM_ENABLED) return null;
  const sys = `You are Replicant’s sales agent.
- You CAN help schedule calls; never say you can't.
- Answer the question first (1–3 sentences), then offer to keep explaining or show times (ET).
- Do not claim you already booked or emailed.
Return STRICT JSON:
{"reply":"<text>","action":{"type":"none|pay|book|email","email":"<optional>"}}`;
  const messages=[{role:"system" as Role, content:sys}, ...(history?.slice(-8)||[]), {role:"user" as Role, content:user}];
  const r = await fetch("https://api.openai.com/v1/chat/completions",{ method:"POST", headers:{ "content-type":"application/json", authorization:`Bearer ${process.env.OPENAI_API_KEY!}` }, body: JSON.stringify({ model: LLM_MODEL, temperature:0.4, max_tokens:220, messages }) });
  const j=await r.json(); const raw=j?.choices?.[0]?.message?.content?.trim(); if(!raw) return null;
  const m = raw.match(/\{[\s\S]*\}/); try{ return JSON.parse(m?m[0]:raw);}catch{ return { reply: raw, action:{ type:"none" as const } }; }
}

/* ---------- route ---------- */
export async function POST(req: NextRequest){
  const origin = new URL(req.url).origin;
  const body = await req.json();
  const history: Msg[] | undefined = body.history;
  const filters = body.filters || {};
  const dateFilter = filters.date as { y:number; m:number; d:number } | undefined;
  const page = typeof filters.page === "number" ? filters.page : 0;

  if ("pickSlot" in body && body.pickSlot?.start && body.pickSlot?.end) {
    const { start, end, email } = body.pickSlot;
    if (!email) return NextResponse.json({ type:"need_email", text:"What’s the best email for the calendar invite?", start, end });
    const res = await fetch(`${origin}${SCHEDULE_API_PATH}`, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ start, end, email }), cache:"no-store" });
    let data:any=null; try{ data=await res.json(); }catch{}
    if(!res.ok){
      const msg = data?.error || data?.message || `schedule returned ${res.status}`;
      return NextResponse.json({ type:"error", text: `Couldn’t book that slot (${msg}). Mind trying another?` }, { status: 500 });
    }
    return NextResponse.json({ type:"booked", text:`Booked — you’re on the calendar for ${fmtET(start)} (ET). I’ve emailed the invite.`, meetLink:data?.meetLink, when: fmtET(start) });
  }

  if ("provideEmail" in body && body.provideEmail?.email) {
    const email = body.provideEmail.email;
    if (dateFilter) {
      const { slots, total } = slotsForDate(dateFilter.y, dateFilter.m, dateFilter.d, page);
      return NextResponse.json({ type:"slots", text:"Great — pick a time that works (ET):", email, slots, date: dateFilter, total });
    }
    return NextResponse.json({ type:"text", text:`Thanks — I’ll use ${email}. Say a day (e.g., Friday) and I’ll show available times (ET).`, email });
  }

  const message:string = body.message ?? "";
  const intent = detectIntent(message);

  if (intent === "book_exact") {
    const day = parseDay(message)!; const hm = parseTime(message)!; const email = latestEmail(history) || extractEmail(message);
    const res = await tryBookExact(origin, day, hm, email || undefined);
    if ((res as any).booked) { const ok=res as any; return NextResponse.json({ type:"booked", text:`Booked — you’re on the calendar for ${ok.label} (ET). I’ve emailed the invite.`, meetLink: ok.meetLink, when: ok.label }); }
    if ((res as any).needEmail) { const p=res as any; return NextResponse.json({ type:"need_email", text:`Perfect — I can book ${p.label} (ET). What’s the best email for the invite?`, start: p.start, end: p.end }); }
    const err = (res as any).message ? ` (${(res as any).message})` : "";
    const { slots } = slotsForDate(day.y, day.m, day.d, 0);
    return slots.length
      ? NextResponse.json({ type:"slots", text:`That exact time may not be open${err} — here are the closest options (ET):`, slots, date: day, total: slots.length })
      : NextResponse.json({ type:"text", text:`I couldn’t find an opening${err}. Want me to show a list of days (ET)?` });
  }

  if (intent === "pricing") {
    return NextResponse.json({ type:"text",
      text:"Yes — most clients launch at **$497 setup** + **$297/month**. That covers configuration, integrations, and ongoing tuning. We can keep chatting here, or I can show available times (ET) for a quick walkthrough." });
  }

  if (intent === "capability") {
    return NextResponse.json({ type:"text",
      text:"Yes — we can set up an agent that books appointments from WhatsApp or Instagram. It qualifies, proposes times, and confirms automatically. Prefer to keep chatting here or see times to talk live? (All times in Eastern Time.)" });
  }

  if (intent === "pay" && STRIPE_URL) {
    return NextResponse.json({ type:"action", action:"open_url", url:STRIPE_URL,
      text:"You can complete checkout whenever you’re ready. Want me to walk you through it here, or show times for a quick Zoom?" });
  }

  if (intent === "book") {
    const day = parseDay(message) || dateFilter;
    if (day) {
      const { slots, total } = slotsForDate(day.y, day.m, day.d, page);
      return NextResponse.json({ type:"slots", text:"Pick a time that works (ET):", slots, date: day, total });
    }
    return NextResponse.json({ type:"ask_day", text:"Which day works for you? (Times are shown in Eastern Time.)" });
  }

  const planned = await llmPlanReply(message, history);
  if (!planned) return NextResponse.json({ type:"text", text:"Happy to help. Ask me anything; when you mention a day I’ll show open times (ET)." });

  const { reply, action } = planned;
  if (action?.type === "pay" && STRIPE_URL) {
    return NextResponse.json({ type:"action", action:"open_url", url:STRIPE_URL,
      text: reply || "You can complete checkout below when you’re ready. Want me to show times or keep explaining?" });
  }
  if (action?.type === "book") return NextResponse.json({ type:"text", text: reply || "If you’d like, I can show available times (ET)." });
  if (action?.type === "email") {
    const email = latestEmail(history) || extractEmail(message) || action?.email;
    if (email) return NextResponse.json({ type:"text", text:`Thanks — I’ll use ${email}. Say a day (e.g., Friday) and I’ll show open times (ET).`, email });
  }
  return NextResponse.json({ type:"text", text: reply || "Got it — want me to keep explaining here, or show available times (ET)?" });
}
