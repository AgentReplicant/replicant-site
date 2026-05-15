# Replicant Sites — Phase Status

**Last updated:** May 12, 2026

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

### Phase 5B — Shared calendar + email adapters + booking orchestrator ✅ (code) ⚠️ pending verification
- `lib/calendar/google.ts` (server-only) — auth, slot lookup, freebusy, lead-time guard, event creation
- `lib/email/sendgrid.ts` (server-only) — `sendCustomerCallConfirmation`
- `lib/booking/phoneCall.ts` (server-only) — `bookAndConfirmPhoneCall` orchestrator
- `/api/slots` thin wrapper around `getAvailableSlots`
- `/api/schedule` thin wrapper around `bookAndConfirmPhoneCall`
- `lib/brain/actions.ts` uses orchestrator directly; no HTTP self-call
- `Slot` and `DateFilter` shared via `lib/brain/types.ts` (temporary; move in Phase 5C)
- Stripe webhook SendGrid call deferred to Phase 5D
- Last verification clean.

**⚠️ NOT YET DONE in current session:**
1. `npm run build`
2. `git add lib/email/sendgrid.ts lib/booking/phoneCall.ts app/api/schedule/route.ts lib/brain/actions.ts lib/calendar/google.ts app/api/slots/route.ts`
3. `git commit -m "refactor(calendar): extract shared calendar + email adapters with booking orchestrator (Phase 5B)"`
4. `git push`
5. Wait for Vercel deploy
6. Regression tests:
   - Test 1: Phone call booking end-to-end via chat (event lands, SendGrid attempts)
   - Test 2: `/api/slots` direct query returns same JSON shape
   - Test 4 grep: no `conferenceData|hangoutLink|sendUpdates|attendees` anywhere
   - Test 5 grep: no `/api/slots`, `/api/schedule`, `baseUrl`, or `fetch(` in `lib/brain`

These are the first actions of the next session.

---

## Open / Next

### Phase 5C — Shared types/contracts (NEXT, after 5B verifies)
- Move `Slot` and `DateFilter` from `lib/brain/types.ts` to a neutral location (e.g., `lib/shared/types.ts`)
- Define shared `LeadPayload` re-export (already canonical in `lib/airtable/leads.ts`)
- Define shared `pickSlot` shape used across widget / chat route / brain / schedule
- Remove `toDateFilterFromWord` dead code in `lib/brain/intents.ts`
- Update all callers

### Phase 3B — Conversational lead capture in Riley (after 5C)
- Riley proactively asks qualifying questions
- Multi-turn state machine for collecting business category, budget, timeline, etc.
- Each answer triggers an `upsertLead` (using the Phase 5A adapter)
- Returning user recognition

### Phase 5D — Stripe webhook extraction (deferred)
- Extract remaining `api.sendgrid.com` call in `app/api/stripe/webhook/route.ts` to use `lib/email/sendgrid.ts`
- Extract inline Airtable `fetch()` calls in same file to use `lib/airtable/leads.ts`
- Add `sendCustomerPaymentReceipt` helper if Stripe checkout becomes active again

### Phase 6 — Returning-User Memory
- "Welcome back — last time you were looking into..."
- Recognize returning leads by email/phone
- Resume from last known conversational state

### Phase 7 — Barber Friend Beta Site (waiting on assets)
- First proof-of-product website
- Real client, real content, real launch

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

- Commit `scripts/*.mjs` as `chore: add airtable schema migration/dump scripts`
- Delete stray `C:\Users\Marlon Lorenzana\package-lock.json` (outside repo, causes Next.js workspace-root warning)
- Remove `GOOGLE_SA_IMPERSONATE` env var from Vercel (no longer used by code)
- Optional: scrub `sa.json` from git history via `git filter-repo` (key already rotated, so not security-critical)
- Email handoff strict regex could use `EMAIL_EXTRACT_RE` for symmetry with opportunistic capture (low priority, working acceptably)