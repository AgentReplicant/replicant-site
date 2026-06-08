# Replicant Sites — Architecture

**Last updated:** June 4, 2026
**Repo:** `replicant-site` (local dev on macOS; auto-deploys to Vercel from `main`)
**Live:** https://replicantapp.com
**Stack:** Next.js 15 (App Router) · React 19 · TypeScript 5 · Tailwind 4 · Node runtime · Vercel hosting

This doc is the system map. It describes what the codebase actually does, how the pieces fit together, and where the known gaps are. Update it when phases close, not before — the master plan describes intent, this describes reality.

> Phases reflected as shipped here have been built, committed, pushed, and regression-tested on the live site unless noted otherwise. See `phase-status.md` for the exact phase order, what's done, and what's next.

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
│       ├── lead/                Thin wrapper → lib/airtable/leads.upsertLead
│       ├── chatlog/             Optional Airtable conversation log (toggle-gated)
│       ├── slots/               Thin wrapper → lib/calendar/google.getAvailableSlots
│       ├── schedule/            Thin wrapper → lib/booking/phoneCall.bookAndConfirmPhoneCall
│       ├── onboarding/          Thin wrapper → lib/airtable/leads (legacy/dormant)
│       ├── instagram/webhook/   IG DM relay (skeleton, not wired)
│       ├── sms/webhook/         Twilio SMS relay (skeleton, not wired)
│       ├── whatsapp/webhook/    WhatsApp relay (skeleton, not wired)
│       ├── stripe/webhook/      Stripe checkout → Airtable Won status (legacy)
│       └── health/, healthz/    Health probes
├── components/
│   ├── navbar.tsx               Sticky dark header; logo is /brand/replicant-logo-white-transparent.png (Phase 7B)
│   ├── footer.tsx
│   ├── sections/                Homepage sections (hero, problem, categories, features, howitworks, pricing, ai-assistants, get-started, faq)
│   └── ui/                      Button, Card primitives
├── lib/
│   ├── utils.ts
│   ├── shared/
│   │   └── types.ts             SHARED neutral types: Slot, DateFilter, PickSlotPayload, QualificationState, LeadProfile (Phase 5C + 3B + 6)
│   ├── airtable/
│   │   └── leads.ts             SHARED Airtable lead adapter (Phase 5A); toLeadProfile mapper + USEFUL_STATUSES (Phase 6)
│   ├── calendar/
│   │   └── google.ts            SHARED Google Calendar adapter (Phase 5B, server-only)
│   ├── email/
│   │   └── sendgrid.ts          SHARED SendGrid adapter (Phase 5B/5D, server-only): sendCustomerCallConfirmation, sendAdminPaymentNotification
│   ├── booking/
│   │   └── phoneCall.ts         SHARED booking orchestrator (Phase 5B, server-only)
│   └── brain/
│       ├── index.ts             Chat brain orchestration; withQualification + withMemory post-processors
│       ├── intents.ts           Intent detection + matchQualificationAnswer (Phase 3B)
│       ├── actions.ts           Slot fetch + booking helpers — calls adapters directly
│       ├── types.ts             Brain types (BrainCtx, BrainResult); shared types re-exported from lib/shared
│       └── copy/en.ts           Single canonical Riley voice copy + Phase 3B qualification copy + Phase 6 returning-greeting copy
├── templates/
│   └── local-service/           Phase 7A — internal reusable starter for service-business client sites
│       ├── README.md
│       ├── TemplatePage.tsx     Assembles all 9 sections; sets --brand CSS var from content
│       ├── types.ts             LocalServiceContent type + sub-types
│       ├── content.example.barber.ts      Fictional example content (NOT proof)
│       ├── content.example.detailing.ts   Fictional example content (NOT proof)
│       └── components/          Hero, Services, Gallery, WhyChooseUs, HowItWorks, Pricing, Reviews, FAQ, Contact
├── docs/replicant-sites/
│   ├── architecture.md          ← this file
│   ├── phase-status.md          What's done / open / next
│   ├── payments.md              Phase 5D — Stripe post-scope payment positioning, allowed Riley language
│   ├── replicant-sites-beta-scope.md
│   ├── replicant-sites-delivery-sop.md
│   └── replicant-sites-launch-checklist.md
├── public/
│   ├── favicon.ico              Auto-detected by Next.js App Router (Phase 7B)
│   ├── brand/                   Phase 7B — logo and mark variants
│   │   ├── replicant-logo-white-transparent.png    Used in navbar on dark backgrounds
│   │   ├── replicant-logo-dark-transparent.png     Reserved for future light backgrounds / invoices / proposals
│   │   ├── replicant-mark-white-transparent.png    Reserved
│   │   ├── replicant-mark-dark-transparent.png     Reserved
│   │   └── replicant-favicon-dark.png              Reserved
│   └── (svgs)                   Existing static assets
├── scripts/                     Phase 3A schema scripts (committed dd90df7)
│   ├── test-calendar.mjs        Local calendar test script
│   ├── dump-airtable-schema.mjs Read Airtable schema via Meta API
│   ├── migrate-airtable-schema.mjs  One-time idempotent Phase 3A migration
│   ├── find-row.mjs             Lookup helper by Name
│   └── find-by-email.mjs        Lookup helper by email
└── sa.json                      Google service account key (untracked, in .gitignore; key already rotated)
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
   │  POST { message, history, filters, sessionId, email, phone, name, qualification, memoryAcknowledged } │
   ▼                                                                    │ ↑
/api/chat (app/api/chat/route.ts)                                       │ │
   │  IF email or phone: findLeadByEmailOrPhone() → toLeadProfile()      │ │
   │  builds BrainCtx (including qualification + leadProfile),           │ │
   │  calls brainProcess()                                               │ │
   ▼                                                                    │ │
lib/brain/index.ts                                                       │ │
   │  Phase 6: seed qualification from leadProfile if active=false       │ │
   │  Phase 6: check category override (first-person framing on new cat) │ │
   │  Phase 3B: qualification answer interception (Case 1-4)             │ │
   │  detectIntent → branches:                                           │ │
   │   • identity / what_is / category / pricing / audit /               │ │
   │     assistant_info / human / human_mode / capability                │ │
   │   • book / day → calls getSlots() via lib/brain/actions.ts          │ │
   │   • pickSlot → calls bookSlot() via lib/brain/actions.ts            │ │
   │                                                                     │ │
   │  Trigger branches wrap returns with:                                │ │
   │     withQualification (Phase 3B opener / re-prompt / Case 3)        │ │
   │     ↓                                                               │ │
   │     withMemory (Phase 6 welcome-back + category override prefix)    │ │
   │                                                                     │ │
   │  Optional LLM tone-smoothing (OpenAI, gated by LLM_ENABLED env)    │ │
   │  normalizeCtaLinks strips markdown wrappers + bare URLs             │ │
   │                                                                     │ │
   ▼  BrainResult ({ type: "text" | "slots" | "booked" | "error" }      │ │
   ▼  + optional qualification patch + optional memoryAcknowledged flag) │ │
ChatWidget renders bubble, possibly updates pending/chosenSlot state ────┘ │
   • renderTextWithLink turns meta.link substring into clickable <a>      │
                                                                            │
Every user message and assistant reply also POSTs to /api/chatlog ─────────┘
   (only logged if CHAT_LOG_ENABLED=1; otherwise no-op)
```

### Brain → adapters (Phase 5B): no more HTTP self-call

`lib/brain/actions.ts` previously called `/api/slots` and `/api/schedule` over HTTP from inside its own Node runtime — an unnecessary round-trip. After Phase 5B:

- `getSlots()` imports and calls `lib/calendar/google.getAvailableSlots` directly
- `bookSlot()` imports and calls `lib/booking/phoneCall.bookAndConfirmPhoneCall` directly

The external `/api/slots` and `/api/schedule` routes still exist (for any direct API caller), but the brain bypasses them. Same shapes returned. No `baseUrl()` helper anywhere in `lib/brain/`.

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

Dead code: `toDateFilterFromWord` exists in `intents.ts` but is never called anywhere. Date translation happens client-side in `ChatWidget.parseNaturalDay`. Slated for removal in Phase 5C cleanup.

### Brain responses (BrainResult types)

- `{ type: "text", text, meta?: { link } }` — plain reply, optionally with a clickable inline link
- `{ type: "slots", text, date, slots }` — text + a list of bookable slots (the widget renders the text; slot picking is conversational, not button-based)
- `{ type: "booked", when }` — confirmation after successful booking
- `{ type: "action", action: "open_url", url, text }` — opens an external URL (kept but rarely used after Stripe deprecation)
- `{ type: "error", text }` — soft error string

### Optional LLM tone smoothing

`lib/brain/index.ts` has a `tone()` helper that, when `LLM_ENABLED=1` and `OPENAI_API_KEY` is set, runs each response string through GPT for natural-sounding rephrasing. The system prompt explicitly forbids any "AI-built" / "AI-generated" language for websites — the grep that finds those phrases in `intents.ts` is hitting the prompt that *forbids* them, not violating them.

Identity, email-handoff, and "what is Replicant?" canonical answers skip tone-smoothing to preserve exact phrasing (the widget depends on specific phrases to trigger handoff states).

After tone-smoothing, `normalizeCtaLinks` runs on the final text. It strips markdown wrappers like `[/website-audit](https://...)` back to plain `/website-audit`, and rewrites bare full URLs to relative paths. This is deterministic post-processing because the LLM ignores the "preserve URLs exactly" instruction reliably enough to require enforcement.

### Clickable inline CTAs (Phase 2.2)

The brain attaches `meta: { link: "/website-audit" }` or `meta: { link: "/get-started" }` to routing responses (audit, assistant_info, pay, capability, all category branches except overview, all pricing branches except overview). Overview branches intentionally have no link — they're informational, not conversion CTAs.

The widget's `renderTextWithLink` helper splits the response text on the link substring and renders it inline as `<a className="underline" target="_blank" rel="noopener noreferrer">`. If the LLM extended the response with a `/website-audit` mention but the brain didn't attach a `meta.link` (e.g., overview branch), the path appears as plain text. That's intentional — links should be brain-routed, not auto-detected from text.

---

## 4. Lead flow

All Airtable lead writes route through `lib/airtable/leads.upsertLead()` (Phase 5A).

Three entry points, all converging on the adapter via `/api/lead`:

```
AuditForm        →  POST /api/lead  { ..., source: "Website Audit",    status: "Audit Requested" }
LeadForm         →  POST /api/lead  { ..., source: "Replicant site",   status: <body.status> }
ChatWidget       →  POST /api/lead  { ..., source: "Chat - Replicant" }                      (Status defaults to "New Lead")
ChatWidget       →  POST /api/lead  { ..., source: "Chat - Email Handoff", status: "Needs Follow-Up" }
                       │
                       ▼
                /api/lead (thin wrapper)
                       │
                       ▼
                lib/airtable/leads.upsertLead(payload)
                       │
                       ├─► findLeadByEmailOrPhone({ email, phone })
                       │     LOWER({Email})="x"  OR  {Phone}="digits"
                       │
                       ├─► IF FOUND: updateLead(id, payload)
                       │             PATCH with buildFields(payload)
                       │             Never overwrites populated fields with blanks
                       │
                       └─► IF NOT FOUND: createLead(payload)
                                         POST with fields, default Status: "New Lead"
                                         typecast: true
```

The same adapter is also called by:
- `/api/onboarding` (legacy/dormant) via `toLeadPayload()` shim
- `/api/stripe/webhook` via `upsertLead` (Phase 5D — extracted from inline HTTP calls)

### Adapter rules (lib/airtable/leads.ts)

- Lookup by email (preferred) or phone digits-only via `findLeadByEmailOrPhone()` — uses an OR-formula matching both fields; phone match uses nested `SUBSTITUTE()` to strip formatting because Airtable's `phoneNumber` field returns formatted strings in formulas (Phase 3B side-fix)
- **`maxRecords=1` behavior:** when multiple rows share a contact (email OR phone), only the first match is returned. Not a bug — but if real-lead testing produces a duplicate phone collision, future-us should know the second row will be silently shadowed. Airtable test row dedup is a known open item.
- Phone is normalized via `normalizePhone()` (strips everything but digits)
- `buildFields()` builds the Airtable fields object by including only keys with truthy values — this is what prevents PATCHes from wiping populated fields with blanks
- `createLead` defaults `Status` to `"New Lead"` if caller didn't specify
- `updateLead` is a no-op if `buildFields` returned an empty object
- Always `typecast: true` for single-select compatibility
- **`toLeadProfile(record)` mapper** (Phase 6) — projects an Airtable record down to a `LeadProfile` (the subset of fields the brain is allowed to see). Includes `status` for gating only — Riley never speaks internal CRM status to the user.
- **`USEFUL_STATUSES` set** (Phase 6) — drives the welcome-back gate. A returning lead's `LeadProfile.isUseful = true` if the row has qualification-grade data OR the status is in this set: `Qualified`, `Audit Requested`, `Won`, `Beta Client`, `Website In Progress`, `Website Delivered`, `Proposal Sent`, `Call Requested`, `Needs Follow-Up`, `Assistant Upsell Offered`. `New Lead` and `Disqualified` alone do not trigger welcome-back.

### Chat lead behavior (live capture)

The chat doesn't wait for a structured form. On every user message, `maybeUpsertLeadFromText` runs three regexes against the message:

- `EMAIL_EXTRACT_RE` — non-anchored, pulls the first email-looking string out of conversational text (added Phase 5A side-fix)
- `PHONE_RE` — pulls the first 7+-digit phone pattern, normalized to digits
- `NAME_RE` — matches "my name is X" / "I'm X" / "I am X" (letters/apostrophes/hyphens only — stops at digits)

If anything matches, the widget POSTs to `/api/lead` immediately. The opportunistic write no longer sends a `status` — the adapter defaults to `"New Lead"`.

**Race condition fix (Phase 5A):** when `pending === "email_handoff"`, opportunistic capture is suppressed. Without this, two writes to Airtable would race — the opportunistic one with `Source: "Chat - Replicant"` and the explicit handoff one with `Source: "Chat - Email Handoff"`. The handoff handler has all the lead info it needs to write the correct row, so opportunistic capture during this state is redundant and harmful.

**Race condition fix extension (Phase 6.1):** same suppression now applies during `pending === "phone"` and `pending === "email"` (the booking-flow contact-collection states). Without this, the chat-flow opportunistic write would race against the single explicit post-booking upsert in the `"booked"` branch of `handleBrainResult`, producing orphan phone-only rows in Airtable. Three live tests (fresh + reused contact combos) confirmed the booking upsert now lands exactly one row per booking with both phone and email populated. See also: `overrideContacts` param on `handleBrainResult` in §7.

### Email handoff flow

A specific branch: when the user picks "email" from the human-handoff offer, the widget enters `pending: "email_handoff"` state. The next user message is parsed via `EMAIL_EXTRACT_RE` (so an email inside conversational text like `"phase5a@example.com testing handoff"` extracts cleanly). If valid, a separate lead upsert fires with `source: "Chat - Email Handoff"` and `status: "Needs Follow-Up"`. The user's free-text note is saved in the `Message` field with a `"Email handoff requested via chat. Last note: ..."` prefix.

Strict whole-string validation (`EMAIL_RE`) is preserved for the final validation step — once the user is explicitly being asked for just an email, the input should be just an email.

### Audit form behavior (Phase 3A)

`AuditForm.tsx` now sends structured fields directly to `/api/lead` instead of bundling them into the `Message` field. The full submission payload:

```ts
{
  name, businessName, email, phone,
  businessCategory, currentWebsiteUrl: normalizeUrl(websiteUrl),
  socialLink: normalizeUrl(socialUrl),
  bookingPlatform, mainGoal: goal, mainProblem: problem,
  budgetRange: budget, desiredTimeline: timeline,
  interestType: "Website",
  message: details.trim(),  // free-text only, no longer the bundled summary
  source: "Website Audit",
  status: "Audit Requested",
}
```

`normalizeUrl()` auto-prepends `https://` if a bare domain is entered (`mybarbershop.com` → `https://mybarbershop.com`). The Current Website and Social Link inputs are `type="text"` instead of `type="url"` so the browser doesn't block bare-domain entries before the helper runs.

### Onboarding route behavior (Phase 5A)

`/api/onboarding` now uses the adapter via a `toLeadPayload()` shim. Legacy fields that no longer exist in the schema (`UseCase`, `MeetingType`, `ChannelsWanted`, `OnboardingJSON`) are silently dropped — the route still accepts them in the request body for backward compatibility but doesn't write them. The legacy `OnboardingPending` status was replaced with `New Lead`. `Website` field reference updated to `Current Website URL`.

The route is functionally dormant (no live caller in current funnel), but won't crash if hit.

### Stripe webhook (Phase 5A → 5D evolution)

Phase 5A side-fix: `checkout.session.completed` writes were updated from `Status: "Paid"` → `Status: "Won"`. `Paid` is no longer a valid Status option in the Phase 3A pipeline, so writes would have silently failed with `typecast: true` dropping the field. The `Won` mapping is semantically correct (completed checkout = closed deal).

Phase 5D completed the extraction: the webhook now uses shared `lib/airtable/leads.upsertLead` and shared `lib/email/sendgrid.sendAdminPaymentNotification`. No more inline `api.sendgrid.com` POSTs or inline Airtable `fetch()` calls. Stripe signature verification is preserved (raw body buffer + `constructEvent`). An idempotency guard (`alreadyProcessed`) skips both the Airtable upsert AND the admin notification on Stripe retries.

### Conversation logging (optional)

`/api/chatlog` logs each turn (user + assistant) to a separate Airtable table (`CONVERSATIONS_TABLE_NAME`, default `Conversations`). Gated by `CHAT_LOG_ENABLED=1`. Default is off. Useful for QA review; not required for normal operation.

---

## 5. Calendar flow

The booking system is **phone-only MVP**. No Google Meet. No calendar attendees. No invite emails sent by Google.

### Shared adapter (Phase 5B)

After Phase 5B, calendar logic lives in `lib/calendar/google.ts` (server-only). The two API routes (`/api/slots`, `/api/schedule`) are thin wrappers. The brain (`lib/brain/actions.ts`) imports the adapter functions directly — no HTTP self-call.

```
lib/calendar/google.ts (server-only)
   │
   ├── getCalendar()                  Auth singleton, broader scope set
   ├── getAvailableSlots({ date, days, limit, page })
   │     Same behavior as old /api/slots GET handler
   ├── bookPhoneCall({ start, end, email, phone, name?, notes? })
   │     Same behavior as old /api/schedule, throws CalendarError on known failures
   └── CalendarError class            { code: "LEAD_WINDOW" | "SLOT_TAKEN" | "BAD_REQUEST" | "CONFIG" | "INTERNAL" }

Types: Slot and DateFilter imported from lib/brain/types.ts (temporary, see Phase 5C in §13)

Helpers (private): pad2, tzOffsetString, wallToUtcZ, dayUtcWindowZ, fmtLabel, fmtInTz, overlaps, isFree, readRules, requireConfig
Public helper: isIsoUtcZ
```

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

### `/api/slots` — fetch available slots (thin wrapper)

`GET /api/slots?y=YYYY&m=MM&d=DD&limit=N&page=N`

The route parses query params and calls `getAvailableSlots()`. All actual logic lives in the adapter.

Adapter behavior:

1. Reads `BOOKING_RULES_JSON` env (day-of-week working windows + `slotMinutes`) plus `SLOTS_LEAD_MINUTES` (default 60)
2. Walks forward from the requested date (or now), one day at a time
3. For each day:
   - Reads the windows for that weekday from rules (skip days with no windows)
   - One `freebusy.query` call per day fetches all busy ranges
   - Steps through the windows in `slotMinutes` increments, excluding lead-time-violating and busy-overlapping slots
   - Accumulates enabled slots until `(page+1)*limit` are collected, then slices to the requested page
4. Returns `Slot[]` of `{ start, end, label, disabled: false }`. The `label` is human-readable ET time formatted like `"Tue, May 12 at 4:30 PM ET"`

Hard-fails (throws) if `GOOGLE_SA_JSON` or `GOOGLE_CALENDAR_ID` is missing.

### `/api/schedule` — book a phone call (thin wrapper)

`POST /api/schedule { start, end, email, phone, name?, notes? }`

The route validates input shape and calls `lib/booking/phoneCall.bookAndConfirmPhoneCall()`. CalendarError instances are mapped to HTTP status codes: `BAD_REQUEST` → 400, `LEAD_WINDOW` and `SLOT_TAKEN` → 409, `CONFIG` and `INTERNAL` → 500.

### Booking orchestrator (Phase 5B)

`lib/booking/phoneCall.ts` (server-only) is the single source of truth for "what happens when a phone call is booked." It pairs the calendar event with the customer confirmation email.

```
bookAndConfirmPhoneCall(args)
   │
   ├── lib/calendar/google.bookPhoneCall(args)
   │     • requireConfig
   │     • validate isIsoUtcZ on start/end + non-empty email/phone
   │     • lead-time guard (60min default) → CalendarError("LEAD_WINDOW")
   │     • isFree(start, end) freebusy re-check → CalendarError("SLOT_TAKEN") if busy
   │     • Build event:
   │         Summary: "Replicant phone call"
   │         Description:
   │           Customer name: <name or "(not provided)">
   │           Customer email: <email>
   │           Customer phone: <phone>
   │           Source: Replicant chat booking
   │
   │           Notes: <notes if provided>
   │     • No attendees, no conferenceData, no sendUpdates
   │     • calendar.events.insert
   │     • Return { ok, eventId, htmlLink?, when, start, end, phone }
   │
   └── lib/email/sendgrid.sendCustomerCallConfirmation({ to, name, phone, when })
         • Best-effort (try/catch internally, never throws)
         • Skips if no SENDGRID_API_KEY or no recipient email
         • Logs status: "sent", "non-OK", "skipped", or "error"
```

Both `/api/schedule` and `lib/brain/actions.ts.bookSlot` call `bookAndConfirmPhoneCall`. Same booking + email behavior on both paths.

### SendGrid adapter (Phase 5B)

`lib/email/sendgrid.ts` (server-only) owns all SendGrid network access. Currently exposes one function:

- `sendCustomerCallConfirmation({ to, name?, phone, when })` — sends the customer their phone-call confirmation email. Best-effort. Same body and subject as the old inline helper.

Defaults:
- `SENDGRID_FROM_EMAIL` (default `agentreplicant@gmail.com`)
- `SENDGRID_FROM_NAME` (default `Replicant`)

---

## 6. Confirmation email (SendGrid)

`lib/email/sendgrid.ts` (server-only) owns all SendGrid network access. Two functions are currently exported:

- `sendCustomerCallConfirmation({ to, name?, phone, when })` — Phase 5B. Sends the customer their phone-call confirmation email after a successful booking. Called by the booking orchestrator (`lib/booking/phoneCall.bookAndConfirmPhoneCall`).
- `sendAdminPaymentNotification({ ... })` — Phase 5D. Sends Marlon an admin notification when a Stripe checkout completes. Called by `/api/stripe/webhook` (no longer an inline `api.sendgrid.com` POST). Idempotency-guarded by Stripe event ID so retries don't double-notify.

Both are **best-effort**: failures are logged but never fail the originating operation (booking or webhook).

```
SendGrid disabled?  →  no SENDGRID_API_KEY  →  log "skipped" → continue
SendGrid 4xx/5xx?   →  log "non-OK" + body  →  continue
SendGrid throws?    →  log "error" + msg    →  continue
SendGrid 200?       →  log "sent"           →  continue
```

The default sender works as long as it's verified in SendGrid. Move to `hello@replicantapp.com` (domain-authenticated) once the domain is set up properly.

**Account status (as of June 2026):** SendGrid is currently returning `401 Maximum credits exceeded` on every send. Bookings still succeed (best-effort guard); confirmation emails fail silently. Riley no longer promises "A confirmation email is on its way" in the booking confirmation (Phase 6.1 copy edit), so this doesn't create a trust gap — just a missed UX nicety. Resolve by adding credits, upgrading the SendGrid plan, or swapping providers.

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
| `pending` | One of `null \| "phone" \| "email" \| "email_handoff"` — what we're waiting for next. Opportunistic `/api/lead` capture is suppressed during all three pending states (Phase 6.1 extension of the Phase 5A email-handoff guard). |
| `qualification` | Phase 3B `QualificationState` — active flag, collected fields, pendingField, repromptCount, recommendedPackage |
| `memoryAcknowledged` | Phase 6 flag — true after Riley has delivered welcome-back this session; resets when contact email/phone changes |
| `sid` | Persistent session ID in localStorage |

All persisted to `localStorage` under `replicant_chat_v13` (bumped from v12 in Phase 3B for fresh qualification shape; v13 also accommodates Phase 6 `memoryAcknowledged` field). On restore, `pending` is whitelisted to a known value and `qualification`/`memoryAcknowledged` undergo shape sanity checks; unknown old shapes get a fresh default.

### Two email regexes (Phase 5A)

`EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i` — anchored, requires the entire string to be just an email. Used only for the final validation step in the email-handoff state (`!EMAIL_RE.test(val)`).

`EMAIL_EXTRACT_RE = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/i` — non-anchored, extracts the first email-looking substring from inside a longer message. Used in:
- `maybeUpsertLeadFromText` (opportunistic capture during any state)
- Email-handoff branch's initial extraction (so the user can type "myemail@example.com plus a note" in one message)

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
→ brain → bookSlot → lib/booking/phoneCall.bookAndConfirmPhoneCall
→ lib/calendar/google.bookPhoneCall (creates event)
→ lib/email/sendgrid.sendCustomerCallConfirmation (best-effort, currently 401)
→ widget renders "All set for <when>. We'll call you at the number you provided."

### Booking → Airtable upsert (Phase 6.1)

After `handleBrainResult` receives a `{ type: "booked" }` from the brain, it does a single explicit Airtable upsert containing both phone + email + any qualification fields collected. This is the *only* `/api/lead` call during the booking flow — opportunistic capture is suppressed across `pending: "phone"` and `pending: "email"` (and `"email_handoff"` from Phase 5A) so two writes don't race.

The explicit upsert is best-effort (`try/catch`), so an Airtable hiccup never fails the booking confirmation Riley shows the user.

**`overrideContacts` param.** The `pending === "email"` branch calls `handleBrainResult(result, { email: val, phone })` — passing the fresh values directly instead of relying on closure-captured React state. Without this, `setEmail(val)` hasn't flushed by the time the booking-flow upsert runs in the same render, and the upsert would send `email: undefined` and produce a phone-only orphan row. This is the canonical fix for the "setX(val) → state stale in same-turn closure" pattern in this codebase. Same pattern still needs to be applied to opportunistic capture in the chat-request body (open follow-up).

Three live tests passed (May/June 2026): fresh email + fresh phone → new Airtable row, fresh email + reused phone → existing row updated (matched on phone via `findLeadByEmailOrPhone`), reused email + fresh phone → existing row updated with `Status: Qualified` preserved (adapter doesn't overwrite Status when payload omits it).

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
| `AIRTABLE_TOKEN` | All lead writes. **Scopes required:** `data.records:read`, `data.records:write`, `schema.bases:read`, `schema.bases:write` (the schema scopes were added in Phase 3A for migration scripting) |
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
| `NEXT_PUBLIC_SITE_URL` / `SITE_URL` | Base URL for any external API caller. The brain no longer uses this (Phase 5B removed self-calls). |

### Used by legacy / future routes

| Env | Used by |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe webhook (Phase 5D — verifies signatures) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` | **Legacy** — only `app/cancel/page.tsx` reads it. No active funnel surfaces this. Safe to remove from Vercel once `app/cancel/` is revisited (follow-up). |
| `ADMIN_NOTIFY_EMAIL` | Stripe webhook admin notification (via `sendAdminPaymentNotification`) |

### Removed / no longer used

| Env | Why removed |
| --- | --- |
| `GOOGLE_SA_IMPERSONATE` | Was used for domain-wide delegation impersonation. The auth model no longer uses `subject:`. Safe to remove from Vercel. |

---

## 9. CTA routing rules

What the chat does when it wants the user to take an action:

| Intent | CTA |
| --- | --- |
| Website interest / audit interest | Brain attaches `meta: { link: "/website-audit" }`. Widget renders as inline clickable `<a>`. (Phase 2.2) |
| Assistant upgrade interest | Brain attaches `meta: { link: "/get-started" }`. Widget renders as inline clickable `<a>`. (Phase 2.2) |
| Overview branches (category/pricing/etc.) | Intentionally no `meta.link`. If the LLM extends the response with a `/website-audit` mention, it appears as plain text — not a clickable link. By design: don't auto-link CTAs the brain didn't route to. |
| Wants to talk to a person | Riley asks: "phone call or email follow-up?" Phone → booking flow. Email → email handoff capture. |
| Pricing question (any tier) | Quotes starting-at price, then routes to audit (`/website-audit`) or get-started depending on tier. Same `meta.link` mechanism. |
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
Built for an older Stripe-paid intake flow. Asks for business details, meeting type (currently still lists "Google Meet" as an option ⚠️ — see §13), and writes to Airtable with `Source: "Onboarding"`. After Phase 5A, the route uses the shared adapter via a `toLeadPayload()` shim and writes only fields that still exist in the new schema. The booking it implies would hit the same calendar path, but no user goes here from the current chat or homepage.

### `/api/stripe/webhook`
Stripe checkout completion webhook. Looks up or creates a lead by email, sets `Status: "Won"` (was `"Paid"` before Phase 5A) and `Source: "Stripe"`, optionally emails an admin via SendGrid. Still functional. Tied to whatever Stripe payment link is configured in env. Not surfaced anywhere in the current chat (the `pay` intent now routes to assistant interest instead of Stripe).

After Phase 5D: webhook uses shared `lib/airtable/leads.upsertLead` and shared `lib/email/sendgrid.sendAdminPaymentNotification`. No more inline `api.sendgrid.com` POSTs or inline Airtable `fetch()` calls. Stripe signature verification preserved (raw body buffer + `constructEvent`). Idempotency guard (`alreadyProcessed`) skips both Airtable upsert AND admin notification on Stripe retries.

**Positioning (per `docs/replicant-sites/payments.md`):** Stripe is POST-scope payment collection only — no public self-checkout, no "Buy Now" buttons on homepage / pricing / audit / chat. Riley continues to route via Marlon: "Once scope is confirmed, Marlon can send over the payment link." If Stripe checkout ever becomes active for public self-serve, revisit this section.

### `/api/instagram/webhook`, `/api/sms/webhook`, `/api/whatsapp/webhook`
Brain adapter skeletons for non-web channels. Each one converts a platform payload to a `{ message, sessionId }`, calls `brainProcess`, and converts the response back. None are wired to actual platform webhooks yet. They'll be expanded in Phase 10.

### `/api/health`, `/api/healthz`
Simple liveness probes.

### `scripts/test-calendar.mjs`
Local script for testing calendar auth + slot generation outside of the Next.js app. Useful for debugging service account issues.

### `scripts/*.mjs` (Phase 3A migration helpers)
Untracked but kept in the repo for future use:

- `dump-airtable-schema.mjs` — read the schema via Airtable Meta API and print tables/fields/options
- `migrate-airtable-schema.mjs` — one-time idempotent Phase 3A migration (renames, deprecation, new fields). Reusable for future schema changes.
- `find-row.mjs` — query Airtable for a row by Name
- `find-by-email.mjs` — query Airtable for rows by email

All read env vars for `AIRTABLE_TOKEN` + `AIRTABLE_BASE_ID`. Worth committing as `chore: add airtable schema scripts` when convenient.

---

## 12. Airtable schema (current state — post Phase 3A)

**Table:** `Leads` (configurable via `AIRTABLE_TABLE_NAME`).

### Active fields written by current code

| Field | Type | Source(s) |
| --- | --- | --- |
| `Name` | singleLineText | All entry points |
| `Business Name` | singleLineText | AuditForm, onboarding (was `Company`) |
| `Email` | email | All entry points |
| `Phone` | phoneNumber | All entry points |
| `Business Category` | singleSelect | AuditForm (was `Vertical`) |
| `Current Website URL` | singleLineText | AuditForm, onboarding (was `Website`) |
| `Social Link` | url | AuditForm |
| `Booking Platform` | singleSelect | AuditForm |
| `Main Goal` | singleSelect | AuditForm |
| `Main Problem` | singleLineText | AuditForm |
| `Budget Range` | singleSelect | AuditForm (was `BudgetBand`) |
| `Desired Timeline` | singleSelect | AuditForm (was `Timeline`) |
| `Interest Type` | singleSelect | AuditForm hard-codes `"Website"` |
| `Recommended Package` | singleSelect | Manually set on review (not auto-written) |
| `Message` | multilineText | All entry points (free-text only post Phase 3A) |
| `Source` | singleSelect | All entry points |
| `Status` | singleSelect | All entry points (defaults to `New Lead`) |
| `Notes` | richText | Manual |
| `Created Time` | createdTime | Auto |
| `Appointment Time` | date | Reserved for future calendar→Airtable sync |
| `StripePaymentId` | singleLineText | Stripe webhook |
| `Conversations` | multipleRecordLinks | Reserved for Conversations table linkage |
| `ExternalIds` | multilineText | Reserved for cross-channel identity |
| `LastSpokeAt` | rollup | Auto from Conversations |

### Single-select option values

```
Source       [Stripe | Manual | Replicant site | API | Instagram | WhatsApp | SMS |
              Onboarding | Chat - Replicant | Chat - Email Handoff |
              Website Audit | Get Started]

Status       [New Lead | Audit Requested | Audit Sent | Call Requested | Proposal Sent |
              Won | Lost | Beta Client | Website In Progress | Website Delivered |
              Assistant Upsell Offered | Qualified | Needs Follow-Up | Disqualified]

Business Category    [Beauty & Grooming | Wellness & Aesthetics | Home & Trade Services | Other]
Budget Range         [Under $500 | $500–$1,000 | $1,000–$2,500 | $2,500+]
Desired Timeline     [ASAP | 1–2 weeks | This month | Just exploring]
Booking Platform     [Booksy | Square | Calendly | Acuity | Fresha | Other | None]
Main Goal            [More bookings | More calls | More quote requests |
                      More consultations | Better online presence]
Interest Type        [Website | Assistant | Both | General]
Recommended Package  [Starter Website | Booking / Quote Website |
                      Website + Replicant Assistant | Not Sure Yet]
```

### Fields removed in Phase 3A

`UseCase`, `ChannelsWanted`, `MeetingType`, `AIOpenness`, `InterestLevel`, `PersonaSeen`, `VolumeWeekly`, `OnboardingJSON` — all deleted. They were fossils from the old AI-sales-agent product positioning.

**Table:** `Conversations` (only used if `CHAT_LOG_ENABLED=1`).

Fields: `ID`, `Related Lead`, `Ts`, `Channel`, `SessionId`, `Role`, `Text`, `MessageId`, `PersonaAtTime`, `Tags`, `Meta`. One row per chat turn.

`PersonaAtTime` is a fossil from the old multi-persona system. Cleanup deferred until `CHAT_LOG_ENABLED=1` is turned on for real.

---

## 13. Known gaps and follow-ups

Things that work, but aren't ideal. Ordered roughly by how much they bite.

### Chat / UX
- **React stale-state pattern, generalized.** Phase 6.1 fixed this specifically for the booking flow via `overrideContacts` on `handleBrainResult` (see §7). The same pattern still applies to opportunistic capture in the chat-request body: combining "my email is X" + a new question in ONE message sends `email: undefined` because `setEmail(val)` hasn't flushed yet, so Phase 6 welcome-back can't fire on that turn. Fix: send `effectiveEmail`/`effectivePhone` (current state || new extract) in the chat request body — same pattern.
- **Bare-number slot picker ambiguity.** Typing `5` when offered 4:30 / 5:30 / 6:00 picks 4:30 (tie-break in `selectSlotFromUserText`). Improve to prefer exact `:00` match over nearest `:30`. Low priority.
- **Phase 6 qualification-seed-skip not fully verified.** If profile has fully populated qualification fields, qualification should jump straight to recommendation on first trigger. Needs an Airtable seeded-row test to confirm `nextPendingField` skips correctly.
- **Email handoff strict regex.** The final email validation in the handoff state still uses anchored `EMAIL_RE`. Working acceptably, but could match conversational text via `EMAIL_EXTRACT_RE` for symmetry. Low priority.

### Calendar
- **No-shows have no handling.** If a customer books and doesn't answer the phone, there's no automated follow-up. Manual today.
- **No reschedule/cancel link in the confirmation email.** A customer who wants to change has to reply to the email or message the chat. Acceptable for MVP.
- **No `.ics` attachment in the confirmation email.** Customer can't add it to their own calendar with one click. Could be added with a small SendGrid attachment helper later.
- **The `/onboarding` page still offers "Google Meet" as a meeting type.** Anyone going through that flow today picks an option that would fail in any active booking path. Not blocking because nobody routes there from the current chat or homepage, but flag it before reusing the onboarding flow.

### Lead capture
- **Chat lead capture is opportunistic.** If a user types their email in passing, it's saved even if they didn't intend to start a lead conversation. Acceptable for MVP — better to over-capture than miss a real lead.
- **No de-duplication beyond email/phone match.** Same person from two devices with no email yet → two rows. Also: `findLeadByEmailOrPhone` returns `maxRecords=1`, so if multiple rows share a contact, only the first matches — see §4 adapter rules.
- **Airtable test row dedup.** At least one pre-existing duplicate phone in test data (rows 18 + 61 both `(555) 987-8899` — caught during Phase 6.1 Test B). Cleanup needed before going live with real leads, so a real phone collision doesn't get silently merged into a stale test row.

### Infrastructure
- **SendGrid sender is `agentreplicant@gmail.com`.** Works as a single-sender verification but won't survive heavy volume or domain reputation checks. Move to a domain-authenticated `hello@replicantapp.com` when ready.
- **SendGrid out of credits (still, as of June 2026).** Account-level issue, not code. Booking succeeds; confirmation emails fail silently. Riley no longer promises a confirmation email (Phase 6.1 copy edit). Resolve by adding credits, upgrading the plan, or swapping providers.
- **`sa.json` was tracked in git history until May 2026.** The file is now untracked + gitignored. The leaked service account key has been rotated in Google Cloud, so the leaked one is invalid. Optional housekeeping: scrub the file from git history with `git filter-repo` for hygiene; not security-critical post-rotation.
- **`GOOGLE_SA_IMPERSONATE` env var is no longer used by code** but may still be set in Vercel. Safe to delete from the dashboard.
- **`NEXT_PUBLIC_STRIPE_PAYMENT_LINK` is legacy** — only `app/cancel/page.tsx` reads it. Safe to remove from Vercel once `app/cancel/` is revisited or removed.
- **`app/cancel/` and `app/onboarding/`** should eventually be revisited. Both are leftovers from the older Stripe-paid intake flow and don't fit the current website-first funnel.

### Local environment
- **Mac transfer (May 2026).** Repo was migrated from Windows + PowerShell to macOS + zsh. All session commands now assume macOS (`grep -rn --exclude-dir=...`, `sed`, etc.); old Windows-specific notes (`Select-String`, `Get-ChildItem`) have been retired.
- **macOS case-insensitive filesystem note.** `ls components/` may display both `navbar.tsx` and `Navbar.tsx` because macOS resolves both casings to the same inode, but `git ls-files` confirms only the lowercase is tracked. Do NOT run `rm components/Navbar.tsx` — the alternate casing can resolve to the real tracked file and silently delete it. If a real untracked duplicate appears, handle it via `git mv` on a case-sensitive checkout, not `rm` on macOS.

### Documentation / process
- **No automated tests.** Calendar bugs from earlier sessions would have been caught by a slot-selection test suite. Defer until at least one paying client.

---

## 14. Phase order (from master plan)

Current state and what each phase touches:

| Phase | Status | Scope |
| --- | --- | --- |
| 1 — Public Website Rebrand | ✅ done | Homepage repositioned, audit page live, AI assistants framed as upgrade |
| 2 — Assistant Rebrand + Sales Brain Alignment | ✅ done | Single Riley voice, website-first answers, email handoff, identity handling |
| 2.1 — Calendar simplification | ✅ done | Removed Meet/attendees/impersonation; phone-only MVP; SendGrid confirmation; slot selection bugs fixed |
| 2.2 — Clickable chat CTA patch | ✅ done | `/website-audit` and `/get-started` rendered as inline clickable links via `meta.link` |
| 3A — Lead + Airtable schema expansion | ✅ done | Renames, new fields, fossil deletions, expanded Status pipeline, AuditForm sends structured fields |
| 3B — Conversational lead capture in Riley | ⏭️ after Phase 5C | Multi-turn progressive lead capture during chat |
| 4 — Calendar / Handoff Fixes | ✅ absorbed by 2.1 | No remaining work |
| 5A — Shared Airtable lead adapter | ✅ done | `lib/airtable/leads.ts` is single source of truth; `/api/lead` and `/api/onboarding` use it; Stripe webhook `Status: "Paid"` → `"Won"` |
| 5B — Shared calendar + email adapters + booking orchestrator | ✅ done | `lib/calendar/google.ts`, `lib/email/sendgrid.ts`, `lib/booking/phoneCall.ts`; brain bypasses HTTP self-calls. Live verified May 14. |
| 5C — Shared types / contracts | ✅ done | `lib/shared/types.ts` created; `Slot`/`DateFilter`/`PickSlotPayload` neutral; brain types re-export for back-compat; `LeadPayload` stays canonical in airtable adapter; `toDateFilterFromWord` removed |
| 3B — Conversational lead capture in Riley | ✅ done | 4-field qualification (category/goal/timeline/budget); Cases 1-4 in `withQualification`; first-person infer vs generic confirm; recommendation logic; budget under $500 → Not Sure Yet + audit; pricing regex + Airtable adapter expanded; opportunistic capture merged-state fix. 7 live tests passed. |
| 5D — Stripe webhook extraction + payment readiness | ✅ done | Stripe webhook uses shared `upsertLead` and `sendAdminPaymentNotification`; idempotency guard added; `payments.md` documents POST-scope payment positioning; no public self-checkout, no "Buy Now" buttons. |
| 6 — Returning-User Memory | ✅ done | `LeadProfile` type; chat route does Airtable lookup; `withMemory` post-processor; once-per-session welcome-back; qualification seed from profile; category override with patch flow; status used for gating only, never spoken. 7 live tests passed. |
| 6.1 — Booking CRM stability fixes | ✅ done | Suppressed opportunistic `/api/lead` during `pending: phone/email` (extends Phase 5A's `email_handoff` guard); single explicit post-booking upsert; `overrideContacts` param dodges React stale-state on `setEmail(val)` in same-turn closure; Riley copy no longer promises confirmation email. 3 live tests passed. |
| 7A — Local-service template scaffold | ✅ done | Internal `templates/local-service/` (9 sections, content-driven, brand CSS var, two fictional example content files, anchor tags via `React.createElement` for clipboard safety). Not routed by Next.js; not part of `replicantapp.com`. |
| 7A — Category audit | ✅ done | Decided NOT to rename `Home & Trade Services` — car detailing already functionally supported by Riley regex + categories copy + generic template. Revisit only if 2+ car-detailing leads create friction. |
| 7B — Brand + visual polish | ✅ done | Logo + favicon + 5 brand assets wired; navbar text replaced with white-transparent PNG; hero rebuilt as two-column with static product mockup, cyan glow, faint grid, fade-to-bg transition; Problem section icon tiles match Categories/Features family; section rhythm tightened (wrappers + Features/HowItWorks internal padding); `scroll-margin-top: 80px` for sticky-navbar anchor safety. |
| 7 — First Beta Site | ⏭️ (waiting on assets) | First proof-of-product website. Beta Client #1 is whichever friend (barber or detailing) delivers content first. Engineering side unblocked by Phase 7A. |
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
| **Adapter** | A shared module that owns a specific external concern (Airtable, Google Calendar, SendGrid). Single source of truth. Server-only. Imported by routes and the brain alike. |
| **Orchestrator** | A shared module that pairs two adapter calls into a single domain operation (e.g., `bookAndConfirmPhoneCall` = calendar insert + email send). |
| **Riley** | The assistant's persona name. Site assistant for Replicant. Not a human. |
| **DWD** | Google Workspace Domain-Wide Delegation. Required for service-account impersonation and inviting attendees. We don't have it. |
| **Lead** | A row in the Airtable `Leads` table. Upserted by email (or phone) on every relevant event. |
| **Audit** | The free website audit flow at `/website-audit`. Currently the primary website-interest conversion. |

---

## 16. Brand assets + visual system (Phase 7B)

### Brand assets

All logo and mark variants live under `public/brand/` and are referenced as root-relative URLs (`/brand/...`) per Next.js static-asset conventions:

| File | Used where |
| --- | --- |
| `replicant-logo-white-transparent.png` | Navbar — wired in `components/navbar.tsx` as a plain `<img>` (no `next/image`; project doesn't use it elsewhere). Sized `h-7 w-auto`. `alt="Replicant"` for fallback / accessibility. Wrapping `<a href="/" aria-label="Replicant home">`. |
| `replicant-logo-dark-transparent.png` | Reserved for future light-background surfaces (invoices, proposals, PDF exports) |
| `replicant-mark-white-transparent.png` | Reserved (icon-only variant for tight spaces) |
| `replicant-mark-dark-transparent.png` | Reserved |
| `replicant-favicon-dark.png` | Reserved (alternate favicon if `app/icon.tsx` is ever added) |
| `public/favicon.ico` | Active favicon. Next.js App Router auto-detects this file — no `metadata.icons` needed in `app/layout.tsx`. |

### Visual system

The site uses a single dark theme defined in `app/globals.css`:

- `:root` CSS vars: `--background: #0B0E12`, `--foreground: #ffffff`
- `@theme inline` block (Tailwind v4 syntax) maps those to `--color-background` / `--color-foreground` for utility classes
- Body: `background: var(--background); color: var(--foreground)`

### Tailwind v4 specifics

- **Fractional opacity utilities use bracket notation.** `bg-white/8` is NOT a valid step in Tailwind v4 — use `bg-white/[0.08]`. Valid shorthand steps are `/5 /10 /20 /25 /50 /75 /80 /90`; everything else needs brackets.
- **VS Code linter false positive.** VS Code's CSS linter reports `Unknown at rule @theme` on the `@theme inline` block. This is cosmetic — Tailwind v4's PostCSS plugin processes it correctly and builds succeed. Optional silencer: `.vscode/settings.json` with `"css.lint.unknownAtRules": "ignore"`. Not currently committed.
- **No `tailwind.config.ts`.** Tailwind v4 inlines theme tokens via `@theme` in CSS instead of a JS config file. Don't create one.

### Hero background helpers

The hero section in `components/sections/hero.tsx` uses three decorative layers, all `aria-hidden` and `pointer-events-none`:

1. **`.hero-grid-bg` class** (defined in `app/globals.css`): 60px × 60px SVG grid pattern at ~6% opacity, encoded as a data URI in the CSS. Zero network requests. Tiles infinitely.
2. **Radial cyan glow**: inline `style={{ background: "radial-gradient(...)" }}` positioned upper-right, low opacity (`rgba(14, 165, 233, 0.18)`). The HeroMockup card gets its own halo with `rgba(14, 165, 233, 0.22)`.
3. **Bottom fade-to-background**: 128px gradient (`linear-gradient(to bottom, transparent, var(--background))`) at the hero's bottom edge. Smooths the transition into the Problem section without touching `app/page.tsx` wrapper padding.

### Section rhythm

`app/page.tsx` wraps each section in `<section id="..." className="py-12 md:py-20">` (Problem gets tighter `pt-4 pb-12 md:pt-8 md:pb-20` since the hero already fades into it). Individual section components should NOT add their own `py-*` — Features and HowItWorks had it stripped in Phase 7B because the double-padding was adding ~352px of vertical space at every section boundary on desktop.

Hero and `GetStarted` ship their own `<section>` with custom padding by design — both are structurally different from the rest.

### Anchor-jump safety

`app/globals.css` defines:

```css
section[id] {
  scroll-margin-top: 80px;
}
```

This pushes in-page anchor landings (`/#problem`, `/#pricing`, etc.) 80px below the section's top edge, clearing the sticky navbar (~52px content + breathing room) without affecting normal scroll behavior.

### Clipboard-eats-angle-brackets workaround

`<a>` tags pasted from chat into the editor sometimes lose their opening `<a` token (clipboard or editor preprocessing eats the angle brackets). Working pattern across the codebase: use `React.createElement("a", { href, className, key }, label)` instead of JSX `<a>...</a>` for any anchor that's part of a delivered patch. Class strings are usually hoisted to module-level constants (`PRIMARY_CTA_CLASS`, `SECONDARY_CTA_CLASS`, etc.) so the call site stays small.

Applied in: `components/sections/hero.tsx`, `templates/local-service/components/Hero.tsx`, `templates/local-service/components/Contact.tsx`.

`Contact.tsx` adds an `isExternalHref(href)` helper so `target="_blank"` only fires for `https://` URLs — local in-page anchors (`#contact`) open in the same tab.

---

## 17. Internal templates (Phase 7A)

`templates/local-service/` is an **internal, copy-out reusable starter** for service-business client sites. It lives at the repo root, outside `app/`, and is NOT routed by Next.js — it's never served from `replicantapp.com`.

### Structure

```
templates/local-service/
├── README.md
├── TemplatePage.tsx                 Assembles all 9 sections; sets --brand from content
├── types.ts                         LocalServiceContent + sub-types (typed content shape)
├── content.example.barber.ts        Fictional example content — NOT proof
├── content.example.detailing.ts     Fictional example content — NOT proof
└── components/
    ├── Hero.tsx
    ├── Services.tsx
    ├── Gallery.tsx                  Grid mode OR before/after mode
    ├── WhyChooseUs.tsx
    ├── HowItWorks.tsx
    ├── Pricing.tsx
    ├── Reviews.tsx                  Unicode stars, no icon dep
    ├── FAQ.tsx                      Native <details>/<summary>
    └── Contact.tsx                  React.createElement anchors + isExternalHref helper
```

### Design principles

- **Content-driven.** A single typed `LocalServiceContent` object drives every section. Empty sections hide automatically.
- **Brand color is a CSS variable.** `TemplatePage.tsx` sets `style={{ "--brand": content.brand.primaryColor }}` on the page root. Sections use Tailwind arbitrary values like `bg-[var(--brand)]`, `text-[var(--brand)]`, `border-[var(--brand)]`. Hover states use `hover:opacity-90` (CSS-var opacity modifiers are unreliable in Tailwind).
- **Tailwind-only styling.** No additional CSS files. No new dependencies. No Airtable. No Riley chat widget embedded — that's Phase 9.
- **Fictional examples only.** Both content files are clearly labeled "EXAMPLE CONTENT ONLY" / "fictional" / "Do NOT deploy as proof." If real beta-client content lands, it goes in a separate Next.js project, not here.

### Copy-out workflow (per `README.md`)

1. `npx create-next-app@latest client-{name}` (or copy an existing scaffold)
2. Copy `templates/local-service/` into the new project root
3. Create `content.ts` with the real client's data (use one of the example files as a starting shape)
4. Drop client photos into `public/`
5. Deploy as a separate Vercel project
6. Point the client's custom domain at it

### Why this isn't routed inside `app/`

Keeping the template out of the routable tree:

- Prevents accidental Next.js builds from including 9 unused section components in the main bundle
- Keeps `replicantapp.com` focused on the marketing site
- Makes the copy-out workflow obvious: it's a template, not a live page
- Lets the template evolve independently of the main site without redeployment risk

---

## Update protocol

Don't propose edits to this doc inline. When a phase closes, the operator asks for an update and pastes this file plus phase-status.md back into a fresh session.