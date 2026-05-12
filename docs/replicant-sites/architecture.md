# Replicant Sites — Architecture

**Last updated:** May 12, 2026
**Repo:** `replicant-site`
**Live:** https://replicantapp.com
**Stack:** Next.js 15 (App Router) · React 19 · TypeScript 5 · Tailwind 4 · Node runtime · Vercel hosting

This doc is the system map. It describes what the codebase actually does, how the pieces fit together, and where the known gaps are. Update it when phases close, not before — the master plan describes intent, this describes reality.

---

## 1. Top-level layout

```
replicant-site/
├── app/
│   ├── page.tsx                 Homepage (composes section components)
│   ├── layout.tsx               Root layout (Navbar + ChatWidget + globals.css)
│   ├── globals.css              Deterministic dark theme
│   ├── website-audit/page.tsx   Audit landing page (renders AuditForm)
│   ├── get-started/page.tsx     Redirects to /#get-started anchor
│   ├── onboarding/              Stripe-paid intake flow (legacy, see §11)
│   ├── lead/, cancel/, success/, privacy/, terms/   Static/utility pages
│   ├── ui/
│   │   ├── ChatWidget.tsx       The chat widget (state, slot picking, booking flow)
│   │   ├── AuditForm.tsx        Structured audit form → /api/lead
│   │   └── LeadForm.tsx         Generic lead form → /api/lead
│   └── api/
│       ├── chat/                Chat → brain passthrough
│       ├── lead/                Airtable upsert (leads)
│       ├── chatlog/             Optional Airtable conversation log (toggle-gated)
│       ├── slots/               Google Calendar slot fetch
│       ├── schedule/            Google Calendar event creation + SendGrid confirmation
│       ├── onboarding/          Stripe-paid intake (legacy)
│       ├── instagram/webhook/   IG DM relay (skeleton, not wired)
│       ├── sms/webhook/         Twilio SMS relay (skeleton, not wired)
│       ├── whatsapp/webhook/    WhatsApp relay (skeleton, not wired)
│       ├── stripe/webhook/      Stripe checkout → Airtable Paid status (legacy)
│       └── health/, healthz/    Health probes
├── components/
│   ├── navbar.tsx, footer.tsx
│   ├── sections/                Homepage sections (hero, pricing, faq, etc.)
│   └── ui/                      Button, Card primitives
├── lib/
│   ├── utils.ts
│   └── brain/
│       ├── index.ts             Chat brain orchestration
│       ├── intents.ts           Intent detection (regex-based)
│       ├── actions.ts           Slot fetch + booking action helpers
│       ├── types.ts             Brain types (BrainCtx, BrainResult, Slot, etc.)
│       └── copy/en.ts           Single canonical Replicant voice copy
├── docs/replicant-sites/
│   ├── architecture.md          ← this file
│   ├── phase-status.md          What's done / open / next
│   ├── replicant-sites-beta-scope.md
│   ├── replicant-sites-delivery-sop.md
│   └── replicant-sites-launch-checklist.md
├── public/                      Static assets (svgs)
├── scripts/test-calendar.mjs    Local calendar test script
└── sa.json                      Google service account key (untracked, in .gitignore)
```

Public-facing routes the user hits directly: `/`, `/website-audit`, `/get-started` (redirects to `/#get-started`).
The chat widget is mounted globally in `layout.tsx`, so it appears on every page.

---

## 2. Public site routes

| Route | Renders | Source of leads |
| --- | --- | --- |
| `/` | Homepage — hero, problem, categories, features, how-it-works, pricing, ai-assistants, get-started, faq | Chat + Get Started form |
| `/website-audit` | Audit landing + `AuditForm` | Audit form → `/api/lead` |
| `/get-started` | Redirects to `/#get-started` (anchor on homepage) | `LeadForm` → `/api/lead` |
| `/privacy`, `/terms`, `/cancel`, `/success` | Static utility pages | — |
| `/onboarding` | Stripe-paid intake form (legacy, see §11) | `/api/onboarding` |

The homepage section component names mostly match what they render. `components/sections/categories.tsx` is the three-vertical (Beauty & Grooming / Wellness & Aesthetics / Home & Trade Services) showcase.

---

## 3. Chat flow

```
User types
   │
   ▼
ChatWidget (app/ui/ChatWidget.tsx)
   │
   │  POST { message, history, filters, sessionId, email, phone, name } │
   ▼                                                                    │ ↑
/api/chat (app/api/chat/route.ts)                                       │ │
   │  builds BrainCtx, calls brainProcess()                              │ │
   ▼                                                                    │ │
lib/brain/index.ts                                                       │ │
   │  detectIntent → branches:                                           │ │
   │   • identity / what_is / category / pricing / audit /               │ │
   │     assistant_info / human / human_mode / capability                │ │
   │   • book / day → calls getSlots() via lib/brain/actions.ts          │ │
   │   • pickSlot → calls bookSlot()                                     │ │
   │                                                                     │ │
   │  Optional LLM tone-smoothing (OpenAI, gated by LLM_ENABLED env)    │ │
   │                                                                     │ │
   ▼  BrainResult ({ type: "text" | "slots" | "booked" | "error" })     │ │
ChatWidget renders bubble, possibly updates pending/chosenSlot state ────┘ │
                                                                            │
Every user message and assistant reply also POSTs to /api/chatlog ─────────┘
   (only logged if CHAT_LOG_ENABLED=1; otherwise no-op)
```

### Brain intents (lib/brain/intents.ts)

Regex-based intent classifier. In match order:

1. `human_mode` (phone / email — bare-word replies after "phone or email?" prompt)
2. `pay` (deprecated, routed to assistant interest)
3. `identity` ("are you AI?", "who are you?")
4. `what_is` ("what is Replicant?")
5. `audit` ("free audit", "review my site")
6. `category` (beauty / wellness / home_trade / overview)
7. `human` ("talk to a person")
8. `pricing` (with tier sub-classification: starter / booking / assistant / overview)
9. `assistant_info` (assistant upgrade questions)
10. `book` (scheduling intent: "book a call", "available times")
11. `day` (day word + optional part-of-day: "tuesday afternoon")
12. `capability` (generic "can it do X" questions)
13. `fallback`

Dead code: `toDateFilterFromWord` exists in `intents.ts` but is never called anywhere. Date translation happens client-side in `ChatWidget.parseNaturalDay`. Slated for removal in Phase 5 cleanup.

### Brain responses (BrainResult types)

- `{ type: "text", text }` — plain reply
- `{ type: "slots", text, date, slots }` — text + a list of bookable slots (the widget renders the text; slot picking is conversational, not button-based)
- `{ type: "booked", when }` — confirmation after successful booking
- `{ type: "action", action: "open_url", url, text }` — opens an external URL (kept but rarely used after Stripe deprecation)
- `{ type: "error", text }` — soft error string

### Optional LLM tone smoothing

`lib/brain/index.ts` has a `tone()` helper that, when `LLM_ENABLED=1` and `OPENAI_API_KEY` is set, runs each response string through GPT for natural-sounding rephrasing. The system prompt explicitly forbids any "AI-built" / "AI-generated" language for websites — the grep that finds those phrases in `intents.ts` is hitting the prompt that *forbids* them, not violating them.

Identity, email-handoff, and "what is Replicant?" canonical answers skip tone-smoothing to preserve exact phrasing (the widget depends on specific phrases to trigger handoff states).

---

## 4. Lead flow

Three entry points, all converging on `/api/lead`:

```
AuditForm        →  POST /api/lead  { ..., source: "Website Audit",    status: "Audit Request" }
LeadForm         →  POST /api/lead  { ..., source: "Replicant site",   status: <body.status> }
ChatWidget       →  POST /api/lead  { ..., source: "Chat - Replicant", status: "Engaged" }
ChatWidget       →  POST /api/lead  { ..., source: "Chat - Email Handoff", status: "Needs Follow-Up" }
                       │
                       ▼
                /api/lead (app/api/lead/route.ts)
                       │
                       │  upsert by email (or phone if no email)
                       ▼
                Airtable (AIRTABLE_BASE_ID / AIRTABLE_TABLE_NAME, default "Leads")
```

### Upsert behavior

`/api/lead` finds an existing record by `LOWER({Email})` (preferred) or exact `{Phone}` match. If found, it PATCHes the existing record; otherwise it creates one. `typecast: true` is passed so Airtable accepts new option values for single-select fields.

### Chat lead behavior (live capture)

The chat doesn't wait for a structured form. On every user message, `maybeUpsertLeadFromText` runs three regexes against the message:

- `EMAIL_RE` — pulls the first email-looking string
- `PHONE_RE` — pulls the first 7+-digit phone pattern, normalized to digits
- `NAME_RE` — matches "my name is X" / "I'm X" / "I am X"

If anything matches, the widget POSTs to `/api/lead` immediately. This is why Airtable accumulates `Chat - Replicant` rows during testing — every typed email and phone in the chat creates or updates a lead row.

### Email handoff flow

A specific branch: when the user picks "email" from the human-handoff offer, the widget enters `pending: "email_handoff"` state. The next user message is parsed for an email address. If valid, a separate lead upsert fires with `source: "Chat - Email Handoff"` and `status: "Needs Follow-Up"`. The user's free-text note is saved in the `Message` field.

### Fields currently written

The route writes whatever subset of these is provided: `Name`, `Email`, `Phone`, `Message`, `Source`, `Status`. Phase 3 will expand this to the full schema (Business Category, Main Goal, Budget Range, Timeline, Interest Type, Recommended Package, etc.).

### Conversation logging (optional)

`/api/chatlog` logs each turn (user + assistant) to a separate Airtable table (`CONVERSATIONS_TABLE_NAME`, default `Conversations`). Gated by `CHAT_LOG_ENABLED=1`. Default is off. Useful for QA review; not required for normal operation.

---

## 5. Calendar flow

The booking system is **phone-only MVP**. No Google Meet. No calendar attendees. No invite emails sent by Google.

### Service account model — locked in by design

This system uses a Google service account that **authenticates as itself, not as a user**. The booking calendar is shared (read+write) with the service account email. The app uses an explicit `GOOGLE_CALENDAR_ID` env var, not the literal `"primary"` calendar.

**This design is non-negotiable** without a Google Workspace upgrade. The following must never be reintroduced:

| ❌ Don't | Reason |
| --- | --- |
| `clientOptions: { subject: ... }` in `GoogleAuth` | Requires Workspace domain-wide delegation. Without it: `unauthorized_client` error. |
| `attendees: [{ email }]` in event payload | Service accounts can't invite attendees without DWD. Event insert fails entirely with "Service accounts cannot invite attendees". |
| `conferenceData: { createRequest: ... }` for Meet links | Same DWD requirement. Also: Meet links from non-Workspace service accounts have inconsistent behavior. |
| `sendUpdates: "all"` | Pointless without an attendees array, and the Google API has historically silently 401'd this combo on free-tier service accounts. |
| `GOOGLE_CALENDAR_ID || "primary"` fallback | Service account has no "primary" calendar in any meaningful sense. Silently misbehaves. Must hard-fail if env is missing. |

If we ever decide to add Meet/invites back, the cost is: Google Workspace subscription ($6/mo+), a domain on Workspace, configuring domain-wide delegation in Google Admin, and updating both calendar routes to use `subject` impersonation. Deferred indefinitely.

### `/api/slots` — fetch available slots

`GET /api/slots?y=YYYY&m=MM&d=DD&limit=N&page=N`

Reads `BOOKING_RULES_JSON` env (day-of-week working windows + `slotMinutes`) plus `SLOTS_LEAD_MINUTES` (default 60). Walks forward from the requested date (or now), one day at a time. For each day:

1. Reads the windows for that weekday from rules (skip days with no windows)
2. One `freebusy.query` call per day fetches all busy ranges
3. Steps through the windows in `slotMinutes` increments, excluding lead-time-violating and busy-overlapping slots
4. Accumulates enabled slots until `(page+1)*limit` are collected, then slices to the requested page

Returns `{ ok: true, slots: [{ start, end, label, disabled: false }] }`. The `label` is human-readable ET time formatted like `"Tue, May 12 at 4:30 PM ET"`.

Hard-fails with 500 if `GOOGLE_SA_JSON` or `GOOGLE_CALENDAR_ID` is missing.

### `/api/schedule` — book a phone call

`POST /api/schedule { start, end, email, phone, name?, notes? }`

All four primary fields required (phone is required because phone is the only booking mode). Returns 400 otherwise.

Flow:
1. Config check — hard-fail if `GOOGLE_SA_JSON` or `GOOGLE_CALENDAR_ID` missing
2. ISO format + required-field validation
3. Lead-time guard (default 60 min) — returns 409 `LEAD_WINDOW` if too soon
4. `freebusy.query` re-check on the exact slot — returns 409 `SLOT_TAKEN` if busy
5. Build event:
   - Summary: `"Replicant phone call"`
   - Description (always internally generated, never accepted from request body):
     ```
     Customer name: <name or "(not provided)">
     Customer email: <email>
     Customer phone: <phone>
     Source: Replicant chat booking

     Notes: <notes if provided>
     ```
   - No attendees, no conferenceData, no sendUpdates
6. `calendar.events.insert` — creates event on `GOOGLE_CALENDAR_ID`
7. Best-effort SendGrid confirmation to the customer (see §6)
8. Returns `{ ok: true, eventId, htmlLink, when, start, end, phone }`

The brain's `bookSlot` action helper in `lib/brain/actions.ts` wraps this with a thin fetch. Note: the brain currently calls `/api/slots` and `/api/schedule` over HTTP from inside its own Node runtime — an unnecessary round-trip slated for Phase 5 (shared adapters).

---

## 6. Confirmation email (SendGrid)

After a successful booking, `/api/schedule` calls `sendCustomerConfirmation()`. The send is **best-effort**: failures are logged but never fail the booking.

```
SendGrid disabled?  →  no SENDGRID_API_KEY  →  log "skipped" → continue
SendGrid 4xx/5xx?   →  log "non-OK" + body  →  continue
SendGrid throws?    →  log "error" + msg    →  continue
SendGrid 200?       →  log "sent"           →  continue
```

Sender configuration:
- `SENDGRID_FROM_EMAIL` (default `agentreplicant@gmail.com`)
- `SENDGRID_FROM_NAME` (default `Replicant`)

The default sender works as long as it's verified in SendGrid. Move to `hello@replicantapp.com` (domain-authenticated) once domain is set up properly.

This same SendGrid pattern is also used in `/api/stripe/webhook/route.ts` for admin payment notifications (legacy Stripe flow).

---

## 7. ChatWidget state machine

The widget owns most of the conversational state. The brain is essentially stateless between requests — context is rebuilt from `history` + `filters` on each call.

State fields:

| Field | Purpose |
| --- | --- |
| `messages` | Visible chat history (user + bot bubbles) |
| `historyRef` | Sent to brain on every call as `history` |
| `email`, `phone`, `name` | Lead identity, harvested live and sent in chat payload |
| `date` | Locked date filter (`{y,m,d}` or null) |
| `page` | Slot pagination cursor |
| `lastSlots` | Most recently offered slot list |
| `chosenSlot` | Slot the user picked, awaiting phone+email completion |
| `pending` | One of `null \| "phone" \| "email" \| "email_handoff"` — what we're waiting for next |
| `sid` | Persistent session ID in localStorage |

All persisted to `localStorage` under `replicant_chat_v12`. On restore, `pending` is whitelisted to a known value (any unknown value, like the deprecated `"mode"` from older versions, is normalized to `null` so old sessions don't get stuck).

### Booking subflow

```
User: "i want to book a call"
  → brain: kind=book → asks for day/time
User: "afternoon"
  → brain: kind=day, partOfDay=afternoon, ctx.date=null
  → brain calls getSlots(null), filters to afternoon, returns 3
  → widget: lastSlots = [s1, s2, s3], renders text
User: "tuesday is good"   (or any day word)
  → widget.selectSlotFromUserText: returns null (no time mentioned)
  → widget.parseNaturalDay: returns Tuesday's date
  → widget locks date, re-calls brain with filters.date set
  → brain narrows fetch to that day
User: "5pm"
  → widget.selectSlotFromUserText: parses "5pm", filters candidates by
     any day mentioned in the text, picks closest time match
  → if a match: setChosenSlot(s), setPending("phone"), ask for number
  → if user named a day not in lastSlots: returns null (fail closed)
User: "5559348888"
  → digits >= 7 → setPhone, setPending("email"), ask for email
User: "name@example.com"
  → EMAIL_RE match → setEmail, call brain with pickSlot payload
  → brain → bookSlot → /api/schedule → calendar event + SendGrid
  → widget renders "All set for <when>..."
```

### Slot picking — key behaviors

`selectSlotFromUserText` in `ChatWidget.tsx`:

1. If text contains `morning|afternoon|evening` → returns null (let brain handle as part-of-day re-fetch)
2. If text contains a day word (weekday, today/tomorrow, or "Month Day") → narrows candidates to that day; **if no candidates on that day, returns null (fail closed, no silent wrong-day booking)**
3. Strips day words and month+day phrases from the text before parsing time, so `"may 12 at 4:30"` doesn't get its `12` parsed as the hour
4. Picks the closest time match in the candidate set, max 75-minute delta

`parseNaturalDay`:

- `"today"`, `"tomorrow"` / `"tmrw"` — exact match returns today / today+1
- `"may 12"`, `"jan 3rd"` etc. — month name + day; returns this year unless that date is already past, then next year
- Weekday words — returns the next occurrence; **if today matches the weekday, returns today (not next week)** unless prefixed with `"next"`

---

## 8. Environment variables (Vercel)

All env vars live in Vercel (no `.env.local` committed). Names only — values are managed in Vercel dashboard.

### Required for chat + booking to work

| Env | Used by |
| --- | --- |
| `OPENAI_API_KEY` | Optional LLM tone-smoothing in brain (off if missing) |
| `LLM_ENABLED` | Set to `1` to enable tone-smoothing |
| `LLM_MODEL` | Optional, defaults to `gpt-4o-mini` |
| `AIRTABLE_TOKEN` | All lead writes |
| `AIRTABLE_BASE_ID` | All lead writes |
| `AIRTABLE_TABLE_NAME` | Defaults to `Leads` |
| `CONVERSATIONS_TABLE_NAME` | Defaults to `Conversations` (only used if `CHAT_LOG_ENABLED=1`) |
| `CHAT_LOG_ENABLED` | Set to `1` to enable per-turn logging |
| `GOOGLE_SA_JSON` | Service account JSON, stringified |
| `GOOGLE_CALENDAR_ID` | The actual shared calendar ID (currently `marlonalm1992@gmail.com`) |
| `BOOKING_TZ` | Defaults to `America/New_York` |
| `BOOKING_RULES_JSON` | Per-weekday working windows + `slotMinutes` (defaults to 30) |
| `SLOTS_LEAD_MINUTES` | Defaults to 60 |
| `SENDGRID_API_KEY` | Required for confirmation email |
| `SENDGRID_FROM_EMAIL` | Defaults to `agentreplicant@gmail.com` |
| `SENDGRID_FROM_NAME` | Defaults to `Replicant` |
| `NEXT_PUBLIC_SITE_URL` / `SITE_URL` | Base URL for the brain's HTTP self-calls |

### Used by legacy / future routes

| Env | Used by |
| --- | --- |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` | Stripe webhook + legacy `/onboarding` |
| `ADMIN_NOTIFY_EMAIL` | Stripe webhook admin notification |

### Removed / no longer used

| Env | Why removed |
| --- | --- |
| `GOOGLE_SA_IMPERSONATE` | Was used for domain-wide delegation impersonation. The auth model no longer uses `subject:`. Safe to remove from Vercel. |

---

## 9. CTA routing rules

What the chat does when it wants the user to take an action:

| Intent | CTA |
| --- | --- |
| Website interest / audit interest | Mentions `/website-audit` in copy. **Currently rendered as literal text, not a clickable link** (known gap, see §13). |
| Assistant upgrade interest | Mentions `/get-started` in copy. Same plain-text rendering. |
| Wants to talk to a person | Riley asks: "phone call or email follow-up?" Phone → booking flow. Email → email handoff capture. |
| Pricing question (any tier) | Quotes starting-at price, then routes to audit (`/website-audit`) or get-started depending on tier. |
| "Pay now" / "checkout" | Deprecated. Routed to assistant interest at `/get-started`. The Stripe checkout URL is no longer surfaced. |

On the homepage and audit page, "Get a Free Audit" buttons are static `<a href="/website-audit">` links from the section components.

---

## 10. Current assistant behavior (the canonical voice)

Single Replicant voice, defined in `lib/brain/copy/en.ts`. The assistant is named **Riley** and is positioned as Replicant's site assistant — not as a human employee, not as a generic chatbot.

### Core stance
- Replicant builds professional websites for service businesses (beauty & grooming, wellness & aesthetics, home & trade services)
- Replicant assistants are an upcoming optional upgrade for those websites
- Websites are professional, never "AI-built" or "AI-generated"
- Calls are an escalation path, not the default — only offered when the user asks for them or for high-intent closing
- Riley is happy to explain the offer, walk through packages, capture lead info, send people to the audit, or register assistant interest

### Identity answer (when asked "are you AI?")
> "I'm Riley, Replicant's site assistant — built to answer questions, explain services, and collect details for website audits. If you need a person, I can route you to Marlon."

### "What is Replicant?" canonical answer
> "Replicant builds professional websites for service businesses, with upcoming assistant upgrades that can answer customer questions, capture leads, and help people book, call, or request quotes."

### Forbidden phrases (must never appear in public copy)
- "AI website"
- "AI-built" / "AI-built website"
- "AI generated" / "AI-generated website"
- "generated website"
- "built with AI"

The one match for these in `lib/brain/index.ts` is the LLM system prompt explicitly *forbidding* them — that's correct code, not a violation. Grep with that in mind.

### Greetings vary on first turn
Three greeting variants in `copy.greetFirstTime`, randomly selected. Returning users (after restore from localStorage) get `copy.greetReturning` variants instead — currently the auto-greet is suppressed on restore, so this is mostly inert until Phase 6.

---

## 11. Legacy / parallel surfaces (not part of MVP funnel)

These exist in the codebase but aren't part of the active website → chat → lead → booking flow. Treat them as "known parallel paths, do not touch unless intentional."

### `/onboarding` page + `/api/onboarding`
Built for an older Stripe-paid intake flow. Asks for business details, meeting type (currently still lists "Google Meet" as an option ⚠️ — see §13), and writes to Airtable with `Source: "Onboarding"`. The booking it implies would hit the same calendar path, but no user goes here from the current chat or homepage.

### `/api/stripe/webhook`
Stripe checkout completion webhook. Looks up or creates a lead by email, sets `Status: "Paid"` and `Source: "Stripe"`, optionally emails an admin via SendGrid. Still functional. Tied to whatever Stripe payment link is configured in env. Not surfaced anywhere in the current chat (the `pay` intent now routes to assistant interest instead of Stripe).

### `/api/instagram/webhook`, `/api/sms/webhook`, `/api/whatsapp/webhook`
Brain adapter skeletons for non-web channels. Each one converts a platform payload to a `{ message, sessionId }`, calls `brainProcess`, and converts the response back. None are wired to actual platform webhooks yet. They'll be expanded in Phase 10.

### `/api/health`, `/api/healthz`
Simple liveness probes.

### `scripts/test-calendar.mjs`
Local script for testing calendar auth + slot generation outside of the Next.js app. Useful for debugging service account issues.

---

## 12. Airtable schema (current state)

**Table:** `Leads` (configurable via `AIRTABLE_TABLE_NAME`).

Fields actively written by the codebase right now:
- `Name`
- `Email`
- `Phone`
- `Message`
- `Source` — one of: `Website Audit`, `Replicant site`, `Chat - Replicant`, `Chat - Email Handoff`, `Onboarding`, `Stripe`
- `Status` — currently uses: `Audit Request`, `Engaged`, `Needs Follow-Up`, `Paid`, `OnboardingPending`
- `Website` (from onboarding flow)
- `UseCase`, `MeetingType`, `ChannelsWanted`, `StripePaymentId`, `OnboardingJSON` (onboarding flow only)

**Phase 3 will expand this** to include: Business Category, Main Goal, Budget Range, Timeline, Interest Type (Website/Assistant/Both/General), Recommended Package, Created At, and a fuller status pipeline (New Lead → Qualified → Audit Sent → Won/Lost/Beta Client/Website In Progress/Website Delivered/Assistant Upsell Offered).

**Table:** `Conversations` (only used if `CHAT_LOG_ENABLED=1`).

Fields: `SessionId`, `Role`, `Message`, `PageURL`, `Source`, `At`. One row per chat turn.

---

## 13. Known gaps and follow-ups

Things that work, but aren't ideal. Ordered roughly by how much they bite.

### Chat / UX
- **Chat renders `/website-audit` as plain text, not a clickable link.** The brain can return `meta: { link }` on text messages but currently never does. Small patch: have audit/get-started copy emit text + meta link, and the widget already renders `meta.link` as an anchor.
- **`pickSlot` shape has no shared type.** Defined inline in `ChatWidget.tsx`, destructured as `any` in `lib/brain/index.ts`, validated inline in `/api/schedule`. Three places, no contract. Cleanup target for Phase 5.
- **`toDateFilterFromWord` in `lib/brain/intents.ts` is dead code.** Stub returning null, no callers. Remove in Phase 5.
- **Brain calls `/api/slots` and `/api/schedule` over HTTP from inside the Node runtime.** Unnecessary round-trip. Phase 5 shared-adapters refactor extracts the actual calendar logic into helpers that both the route handlers and the brain import directly.

### Calendar
- **No-shows have no handling.** If a customer books and doesn't answer the phone, there's no automated follow-up. Manual today.
- **No reschedule/cancel link in the confirmation email.** A customer who wants to change has to reply to the email or message the chat. Acceptable for MVP.
- **No `.ics` attachment in the confirmation email.** Customer can't add it to their own calendar with one click. Could be added with a small SendGrid attachment helper later.
- **The `/onboarding` page still offers "Google Meet" as a meeting type.** Anyone going through that flow today picks an option that would fail in any active booking path. Not blocking because nobody routes there from the current chat or homepage, but flag it before reusing the onboarding flow.

### Lead capture
- **Lead schema is minimal.** Only `Name`, `Email`, `Phone`, `Message`, `Source`, `Status` are actively written from chat. Phase 3 expands this.
- **Chat lead capture is opportunistic.** If a user types their email in passing, it's saved even if they didn't intend to start a lead conversation. Acceptable for MVP — better to over-capture than miss a real lead.
- **No de-duplication beyond email/phone match.** Same person from two devices with no email yet → two rows.

### Infrastructure
- **SendGrid sender is `agentreplicant@gmail.com`.** Works as a single-sender verification but won't survive heavy volume or domain reputation checks. Move to a domain-authenticated `hello@replicantapp.com` when ready.
- **SendGrid out of credits as of May 11, 2026.** Account-level issue, not code. Booking still works, just no confirmation email until credits return / plan changes.
- **`sa.json` was tracked in git history until May 11, 2026.** The file is now untracked + gitignored. The leaked service account key has been rotated in Google Cloud, so the leaked one is invalid. Optional housekeeping: scrub the file from git history with `git filter-repo` for hygiene; not security-critical post-rotation.
- **`GOOGLE_SA_IMPERSONATE` env var is no longer used by code** but may still be set in Vercel. Safe to delete from the dashboard.

### Documentation / process
- **No automated tests.** Calendar bugs from this session would have been caught by a slot-selection test suite. Defer until at least one paying client.

---

## 14. Phase order (from master plan)

Current state and what each phase touches:

| Phase | Status | Scope |
| --- | --- | --- |
| 1 — Public Website Rebrand | ✅ done | Homepage repositioned, audit page live, AI assistants framed as upgrade |
| 2 — Assistant Rebrand + Sales Brain Alignment | ✅ done | Single Riley voice, website-first answers, email handoff, identity handling |
| 2.1 — Calendar simplification | ✅ done (this session) | Removed Meet/attendees/impersonation; phone-only MVP; SendGrid confirmation; slot selection bugs fixed |
| 2.2 — Clickable chat CTA patch | ⏭️ next | Render `/website-audit` and `/get-started` as actual links via `meta.link` |
| 3 — Lead + Airtable Automation | ⏭️ then | Expand Airtable schema (Business Category, Main Goal, Budget Range, Timeline, Interest Type, Recommended Package, fuller status pipeline). Chat-driven progressive lead capture. |
| 4 — Calendar / Handoff Fixes | ⏭️ | Slot labels with full date, mode-switch fix (mostly absorbed by 2.1 already; minor polish remains) |
| 5 — Shared Adapters | ⏭️ | Extract calendar + Airtable helpers; thin API routes; shared `pickSlot` and lead types |
| 6 — Returning-User Memory | ⏭️ | "Welcome back — last time you were looking into..." |
| 7 — Barber Friend Beta Site | ⏭️ (waiting on assets) | First proof-of-product website |
| 8 — `/websites` page with proof | ⏭️ | After 7 |
| 9 — Web Assistant Product | ⏭️ | Sellable assistant add-on |
| 10 — Multi-Platform Expansion | ⏭️ | IG → SMS → WhatsApp → email follow-up (skeleton routes already exist) |
| 11 — Phone Agents | ⏭️ | Voice. Last. |

---

## 15. Glossary

| Term | What it means here |
| --- | --- |
| **Brain** | `lib/brain/` — the chat orchestration layer. Stateless. Takes an input and a context, returns a `BrainResult`. |
| **Intent** | The classified user goal from `detectIntent()`. Drives which branch of the brain runs. |
| **Slot** | A bookable calendar opening. `{ start, end, label }` in UTC + ET-formatted label. |
| **pickSlot** | The payload the widget sends to commit a booking. Currently inline-typed, not shared. |
| **BrainCtx** | Per-request context: channel, history count, locked date, paginated page, last user/assistant turns, lead fields. |
| **BrainResult** | What the brain returns. One of `text \| slots \| booked \| action \| error`. |
| **Riley** | The assistant's persona name. Site assistant for Replicant. Not a human. |
| **DWD** | Google Workspace Domain-Wide Delegation. Required for service-account impersonation and inviting attendees. We don't have it. |
| **Lead** | A row in the Airtable `Leads` table. Upserted by email (or phone) on every relevant event. |
| **Audit** | The free website audit flow at `/website-audit`. Currently the primary website-interest conversion. |

---

## Update protocol

Don't propose edits to this doc inline. When a phase closes, the operator asks for an update and pastes this file plus phase-status.md back into a fresh session.