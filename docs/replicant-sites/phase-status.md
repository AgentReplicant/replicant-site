# Replicant Sites — Phase Status

**Last updated:** June 2, 2026 (Phase 6.1 + 7A shipped)

## Done

### Phase 1 — Public Website Rebrand ✅
- Public copy is website-first
- Forbidden-phrase guard in chat brain system prompt
- Three business categories: Beauty & Grooming, Wellness & Aesthetics, Home & Trade Services
- "Home & Trade Services" renamed from "Rugged Local Services"

### Phase 1.3 — Audit form scaffolding ✅
- `/website-audit` route with `AuditForm.tsx`
- Sends structured fields to `/api/lead`
- Dark dropdown styling fixed

### Phase 2 — Assistant Rebrand + Sales Brain Alignment ✅
- Single Riley voice across all chat responses
- Website-first answers
- Email handoff flow
- Identity handling ("are you AI?")
- Stripe checkout deprecated in chat; routes to `/get-started` assistant interest instead

### Phase 2.1 — Calendar simplification (phone-only MVP) ✅
- Google Meet removed entirely
- Service account is used directly (no impersonation)
- `GOOGLE_CALENDAR_ID` required explicitly, hard-fails if missing
- No `"primary"` fallback
- SendGrid confirmation replaces calendar attendee invites
- Slot-picking respects user-mentioned date + time-of-day
- Same-day weekday returns today; fail-closed when day not in offered slots
- `EMAIL_RE` non-anchored extraction added for opportunistic capture

### Phase 2.2 — Clickable chat CTAs ✅
- Brain attaches `meta.link` to routing responses
- ChatWidget renders inline clickable `<a>` for `/website-audit` and `/get-started`
- `normalizeCtaLinks` strips markdown wrappers + bare URLs
- `rel="noopener noreferrer"` on all CTA links
- Overview branches intentionally have no `meta.link` (no auto-CTA on informational answers)

### Phase 3A — Airtable schema expansion + form wiring ✅
- Schema migrated via `scripts/migrate-airtable-schema.mjs`:
  - **Renamed:** Company → Business Name, Website → Current Website URL, Vertical → Business Category, BudgetBand → Budget Range, Timeline → Desired Timeline
  - **Added:** Social Link, Booking Platform, Main Goal, Main Problem, Interest Type, Recommended Package
  - **Deleted:** UseCase, ChannelsWanted, MeetingType, AIOpenness, InterestLevel, PersonaSeen, VolumeWeekly, OnboardingJSON
  - **Replaced single-select values:** Status (14-value sales pipeline), Business Category (4 values), Budget Range (4 values), Desired Timeline (4 values)
  - **Source: added** "Website Audit" and "Get Started"
- `/api/lead` accepts and writes all 17 structured fields
- `AuditForm` sends structured fields (not bundled into Message)
- Chat opportunistic capture writes `Source: Chat - Replicant`
- Email handoff writes `Source: Chat - Email Handoff`, `Status: Needs Follow-Up`
- Default `Status: New Lead` on create
- Adapter never overwrites populated fields with blanks (Test 4 regression-verified)

### Phase 4 — Calendar / Handoff Fixes ✅ (absorbed by 2.1)
- All Phase 4 items addressed in Phase 2.1. No remaining work.

### Phase 5A — Shared Airtable lead adapter ✅
- `lib/airtable/leads.ts` owns all Airtable lead reads/writes
- Public surface: `LeadPayload`, `normalizePhone`, `findLeadByEmailOrPhone`, `createLead`, `updateLead`, `upsertLead`
- `/api/lead` reduced to thin wrapper
- `/api/onboarding` refactored to use the adapter (dead onboarding fields dropped)
- Stripe webhook: `Status: "Paid"` → `Status: "Won"`

**Side-fixes during 5A:**
- `EMAIL_EXTRACT_RE` for conversational capture (non-anchored)
- Email handoff branch uses `EMAIL_EXTRACT_RE` for opportunistic extract
- Skip opportunistic capture during `email_handoff` state to avoid race condition
- Audit form auto-prepends `https://` for bare domains; URL inputs changed `type="url"` → `type="text"`
- AuditForm `Current Website` label restored after copy/paste mishap during URL patch

### Phase 5B — Shared calendar + email adapters + booking orchestrator ✅ verified / closed
- `lib/calendar/google.ts` (server-only) — auth, slot lookup, freebusy, lead-time guard, event creation
- `lib/email/sendgrid.ts` (server-only) — `sendCustomerCallConfirmation`
- `lib/booking/phoneCall.ts` (server-only) — `bookAndConfirmPhoneCall` orchestrator
- `/api/slots` thin wrapper around `getAvailableSlots`
- `/api/schedule` thin wrapper around `bookAndConfirmPhoneCall`
- `lib/brain/actions.ts` uses orchestrator directly; no HTTP self-call
- Stripe webhook SendGrid call deferred to Phase 5D

**Verification (May 14, 2026):**
- Direct `/api/slots?limit=3` returns expected slot JSON shape
- Riley phone booking works end-to-end (day → afternoon → slot pick → phone → email → confirmation)
- Calendar event creation verified
- SendGrid confirmation is attempted but currently fails gracefully with `401 Maximum credits exceeded`; booking still succeeds
- Greps clean: no `conferenceData|hangoutLink|sendUpdates|attendees` in active app/lib code; no `/api/slots`, `/api/schedule`, `baseUrl`, or `fetch(` self-calls in `lib/brain`

### Phase 5C — Shared types/contracts ✅
- `lib/shared/types.ts` created — neutral, dependency-free
- `Slot`, `DateFilter`, `PickSlotPayload` live in shared
- `lib/brain/types.ts` re-exports `Slot`/`DateFilter` for back-compat; keeps `BrainResult`/`BrainCtx`
- `lib/calendar/google.ts` and `lib/brain/actions.ts` import from `lib/shared/types`
- `ChatWidget.tsx` drops local `Slot`/`DateFilter` re-declarations
- `pickSlot` payload formally typed via `PickSlotPayload` across widget / chat route / brain
- Dead `toDateFilterFromWord` removed from `lib/brain/intents.ts`
- `LeadPayload` stays canonical in `lib/airtable/leads.ts` (no re-export from shared per design)
- No runtime behavior change; build clean

### Phase 3B — Conversational lead capture in Riley ✅
- New types in `lib/shared/types.ts`: `QualificationField`, `QualificationState`
- Brain owns qualification state machine; widget owns persistence + Airtable upserts
- `BrainCtx.qualification` carries state in; `BrainResult.qualification` carries patches out
- Brain helpers: `withQualification`, `recommendPackage`, `nextPendingField`, `promptForField`, `categoryIntentToAirtable`, `isFirstPersonBusinessFraming`, `TRIGGER_INTENTS`, `NO_REPROMPT_INTENTS`
- Intent answer matcher: `matchQualificationAnswer` (regex per field + numeric-fallback for budget)
- Copy keys: `qualifyOffer`, `qualifyAskCategory/Goal/Timeline/Budget`, `qualifyConfirmCategory`, `qualifyRecommend*`, `qualifyReprompt`, `qualifyCategoryOverride`
- Trigger intents fire qualification opener; identity/what_is/human/booking/email-handoff suppressed
- Case 1: trigger + qualification inactive → opener
- Case 2: ignored once → re-prompt; ignored twice → deactivate (data retained)
- Case 3: trigger mid-qualification → answer + soft re-prompt (no counter increment)
- Case 4: contact info mid-qualification → acknowledge + re-prompt + qualification patch (widget upserts collected fields)
- First-person framing infers category silently; generic question confirms first
- Recommendation: budget + goal → Starter / Booking-Quote / Site+Assistant / Not Sure Yet
- Under $500 → "Not Sure Yet" + honest disclosure + audit link
- STORE_KEY bumped v12 → v13
- Pricing regex expanded for `package`, `included`, `tier`, `plan`, bare dollar amounts
- Adapter `findLeadByEmailOrPhone` uses `OR()` formula matching both fields
- Phone formula uses nested `SUBSTITUTE()` to strip formatting (Airtable phoneNumber returns formatted strings in formulas)
- Widget opportunistic upsert merges current state with new extracts (prevents duplicate rows in booking flow)
- All 7 regression tests passed end-to-end on live

### Phase 5D — Stripe webhook extraction + payment readiness ✅
- Stripe webhook (`app/api/stripe/webhook/route.ts`) now uses shared `lib/airtable/leads.upsertLead`
- Admin payment notification extracted to `lib/email/sendgrid.sendAdminPaymentNotification`
- Completed payments map to `Status: Won`, `Source: Stripe`, `StripePaymentId`
- Idempotency guard (`alreadyProcessed`) skips both Airtable upsert AND admin notification on Stripe retries
- Dead `getCheckoutLink` removed from `lib/brain/actions.ts`
- Stripe signature verification preserved (raw body buffer + `constructEvent`)
- `docs/replicant-sites/payments.md` created — documents post-scope payment positioning, recommended flow, Riley's allowed language, env vars, Source overwrite caveat
- Stripe remains POST-scope payment collection only — no public self-checkout
- No "Buy Now" buttons added to homepage / pricing / audit / chat
- Riley continues to route via Marlon: "Once scope is confirmed, Marlon can send over the payment link"

### Phase 6 — Returning-User Memory ✅
- New shared type: `LeadProfile` (subset of LeadPayload safe to surface to brain; includes `status` for gating only, never spoken)
- `lib/airtable/leads.ts` adds `toLeadProfile()` mapper + `USEFUL_STATUSES` set
- Chat API route does Airtable lookup server-side via shared adapter; brain stays IO-free
- `BrainCtx.leadProfile` + `BrainCtx.memoryAcknowledged` added
- `BrainResult.memoryAcknowledged` added (widget flips its flag when brain signals)
- Brain helpers: `buildReturningGreeting()`, `withMemory()` post-processor
- Welcome-back fires once per session; resets when contact email/phone changes
- `isUseful = true` if profile has qualification-grade data OR status is in useful set (Qualified, Audit Requested, Won, Beta Client, Website In Progress/Delivered, Proposal Sent, Call Requested, Needs Follow-Up, Assistant Upsell Offered)
- New Lead and Disqualified statuses alone do NOT trigger welcome-back
- 7 `withMemory` wraps: what_is, pricing, audit, category, assistant_info, capability, fallback
- Suppressed: identity, human, human_mode, book, day, pickSlot, email handoff
- Qualification seeding from profile (skip already-known fields when qualification activates)
- Category override: first-person framing on different category overwrites seeded value, emits qualification patch (widget persists + upserts to Airtable), Riley acknowledges briefly
- Widget-state values always win over profile values (explicit user answer overrides)
- Internal CRM status never spoken in user-facing copy
- 7 acceptance tests passed end-to-end on live

### Phase 6.1 — Booking CRM stability fixes ✅
- Opportunistic `/api/lead` capture suppressed during `pending=phone` and `pending=email` (booking flow) in addition to existing `email_handoff` guard
- Single explicit post-booking upsert in `handleBrainResult` "booked" branch with both phone + email + qualification fields (best-effort, never fails the booking confirmation)
- `handleBrainResult` accepts optional `overrideContacts` param; the `pending === "email"` branch passes `{ email: val, phone }` so the upsert uses fresh values instead of closure-captured stale React state
- Riley no longer promises "A confirmation email is on its way" in the booking confirmation (SendGrid still wired, just silent — credits issue unresolved)
- Three live tests passed: fresh email + fresh phone (new row), fresh email + reused phone (existing row updated), reused email + fresh phone (existing row updated, Qualified status preserved)
- Calendar event creation unchanged; SendGrid adapter code untouched

### Phase 7A — Local-service template scaffold ✅
- `templates/local-service/` at repo root — internal-only reusable starter for service-business client sites
- Not routed by Next.js (lives outside `app/`); not part of `replicantapp.com`
- 9 section components: Hero, Services, Gallery (grid or before/after), WhyChooseUs, HowItWorks, Pricing, Reviews, FAQ, Contact
- Content-driven via single typed `LocalServiceContent` object in `types.ts`; empty sections hide automatically
- Brand color is a CSS variable set on the page root via `style={{ "--brand": content.brand.primaryColor }}`; sections use Tailwind arbitrary values like `bg-[var(--brand)]`. Hover states use `hover:opacity-90` (CSS-var opacity modifiers are unreliable in Tailwind)
- Two example content files (`content.example.barber.ts`, `content.example.detailing.ts`) clearly labeled as fictional — NOT proof
- Anchor tags in `Hero.tsx` and `Contact.tsx` use `React.createElement` to dodge clipboard angle-bracket corruption (workflow rule)
- `Contact.tsx` `ctaLink` uses `target="_blank"` only for external `https://` URLs — local in-page anchors like `#contact` open in same tab
- README documents the copy-out workflow: copy template into a new Next.js project, edit `content.ts`, deploy as a separate Vercel project with the client's domain
- Tailwind-only styling; no extra CSS files; no Airtable integration; no Riley chat widget embedded (future Phase 9)

### Phase 7A — Category audit ✅
- Audited every `Home & Trade Services` reference across code + docs (8 production files + 3 doc files)
- Decision: do NOT rename `Home & Trade Services` to `Local & Trade Services` or split it
- Reason: car detailing is functionally supported today — Riley's regex already matches `detail`, `categories.tsx:24` already mentions "mobile detailing", the generic template works across barber + detailing without category changes
- Rename would require Airtable schema migration + 8 file edits; benefit is purely cosmetic at this point
- Revisit only if 2+ car-detailing leads create real friction

---

## Open / Next

### Phase 7 — First Beta Site (NEXT — waiting on assets)
- First proof-of-product website
- Beta Client #1 is whichever friend delivers content first (barber or car detailing — both compatible with the Phase 7A template)
- Real client, real content, real launch
- Engineering side unblocked by Phase 7A; only blocked on client assets

### Phase 8 — `/websites` page with proof
- After Phase 7
- Public showcase of delivered websites

### Phase 9 — Web Assistant Product
- Sellable assistant add-on
- Wired into delivered websites

### Phase 10 — Multi-Platform Expansion
- IG → SMS → WhatsApp → email follow-up
- Skeleton routes already exist at `/api/instagram/webhook`, `/api/sms/webhook`, `/api/whatsapp/webhook`

### Phase 11 — Phone Agents
- Voice. Last.

---

## Small follow-ups (not blocking phases)

- **SendGrid credits** still blocked (`401 Maximum credits exceeded`). Booking still works; confirmation emails fail silently. Fix credits/plan or swap providers. Phase 6.1 already removed Riley's "confirmation email is on its way" promise so this no longer creates a trust gap, just a missed UX nicety.
- **React stale-state pattern, generalized.** Phase 6.1 fixed this specifically for the booking flow via `overrideContacts` on `handleBrainResult`. The same pattern still applies to opportunistic capture in chat payloads: combining "my email is..." + a new question in ONE message sends `email: undefined` because `setEmail` hasn't flushed yet. Phase 6 welcome-back doesn't fire on that turn. Fix: send `effectiveEmail`/`effectivePhone` (current state || new extract) in chat request body, same pattern.
- Bare-number slot picker ambiguity: typing `5` when offered 4:30/5:30/6:00 picks 4:30. Improve `selectSlotFromUserText` to prefer exact `:00` match over nearest `:30`.
- Verify Phase 6 qualification-seed-skip: if profile has fully populated qualification fields, qualification should jump straight to recommendation on first trigger. Confirm by inspecting `Main Goal` and other fields on a seeded Airtable row and testing.
- **Airtable test row dedup.** At least one pre-existing duplicate phone in test data (rows 18 + 61 both `(555) 987-8899` — caught during Phase 6.1 Test B). Cleanup needed before going live with real leads to avoid confusion when a real phone happens to collide with a stale test row.
- **Adapter `maxRecords=1` behavior worth documenting.** When multiple Airtable rows share a contact (email or phone), `findLeadByEmailOrPhone` only matches the first one. Not a bug — but worth noting in `architecture.md` §4 (Lead flow / Adapter rules) so future-us doesn't get surprised.
- `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` is legacy — only `app/cancel/page.tsx` reads it
- `app/cancel/page.tsx` and `app/onboarding/` should eventually be revisited
- Optional: scrub `sa.json` from git history via `git filter-repo` (key already rotated, so not security-critical)
- Email handoff strict regex could use `EMAIL_EXTRACT_RE` for symmetry with opportunistic capture (low priority, working acceptably)