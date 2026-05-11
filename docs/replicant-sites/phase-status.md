# Replicant Sites — Phase Status

**Last updated:** May 11, 2026
**Repo:** `C:\Users\Marlon Lorenzana\replicant-site`
**Live:** replicantapp.com

---

## Done

- **Phase 1: Public rebrand.** Website-first positioning, dark theme deterministic, `/website-audit` route live with Airtable lead capture.
- **Phase 1.5: Internal ops docs.** SOP, launch checklist, beta scope note, client intake checklist (markdown masters in repo, `.docx` versions saved outside repo).
- **Phase 2: Assistant brain rebrand.**
  - Single Replicant voice (removed 4-persona system)
  - Website-first answers (what is Replicant / categories / pricing / audit)
  - Email handoff added (phone / Google Meet / email)
  - Category regex fixed for full word forms (plumber, hairstylist, etc.)
  - Public rename: Rugged Local Services → Home & Trade Services
  - Chat lead source updated to `Chat - Replicant` / `Chat - Email Handoff`

---

## Open / Nice-to-have

- `/website-audit` shows as literal text in chat instead of clickable link (small patch to render links via `meta.link` in the brain)
- Architecture doc not yet written (recommended next conversation — see "MO for next session" below)

---

## Next phases (per master plan)

1. **Phase 3: Airtable schema expansion.** New fields (Business Category, Main Goal, Budget Range, Timeline, Interest Type, Lead Source, Recommended Package), new statuses (New Lead → Qualified → Audit Sent → Won/Lost/Beta Client/Website In Progress/Website Delivered/Assistant Upsell Offered).
2. **Phase 4: Calendar fixes.** Slot label with full date ("Fri, Mar 28 at 4:30 PM ET"), mode-switch fix during booking flow.
3. **Phase 5: Shared adapters refactor.** Extract Airtable helper, Google Calendar adapter, thin API routes, shared lead schema.
4. **Phase 6: Returning-user memory.** "Welcome back — last time you were looking into a booking site for a salon."
5. **Phase 7: Friend barber site.** Beta Client #1, proof-of-product. Waiting on her filled intake + assets.
6. **Phase 8: `/websites` page.** Real sales page with proof from Phase 7.
7. **Phase 9: Web Assistant product.** Sellable add-on for client sites.
8. **Phase 10: Multi-platform.** Instagram → SMS → WhatsApp → email follow-up.
9. **Phase 11: Phone agents.** Last, premium tier.

---

## Waiting on

- Barber friend's filled intake checklist + assets (Phase 7 trigger)

---

## Key files reference

- `lib/brain/index.ts` — chat brain orchestration
- `lib/brain/intents.ts` — intent detection regex
- `lib/brain/copy/en.ts` — single voice copy
- `lib/brain/actions.ts` — getSlots, bookSlot, getCheckoutLink
- `lib/brain/types.ts` — type definitions
- `app/ui/ChatWidget.tsx` — chat UI + booking/email flows
- `app/website-audit/page.tsx` — audit landing page
- `app/ui/AuditForm.tsx` — structured audit form
- `app/ui/LeadForm.tsx` — generic lead form (used by `/get-started`)
- `app/api/chat/route.ts` — chat API passthrough
- `app/api/lead/route.ts` — Airtable upsert
- `app/api/slots/route.ts` — Google Calendar slot fetch
- `app/api/schedule/route.ts` — Google Calendar booking
- `app/globals.css` — deterministic dark theme
- `components/sections/` — homepage sections (hero, problem, categories, features, howitworks, pricing, ai-assistants, faq, get-started)
- `components/navbar.tsx`, `components/footer.tsx` — site chrome
- `docs/replicant-sites/` — internal SOP / checklist / scope / status

---

## MO for next session

When starting a new conversation, paste this file as the first message and tell Claude which phase to tackle.

Working style rules in effect:
- **Surgical edits by default.** Find/replace blocks with unique lookup strings, no line numbers.
- **Full file replace only when:** file is small (<50 lines) OR change touches 70%+ of file.
- **Chat blocks for delivery,** not artifacts.
- **Verify `<a>` tags didn't get eaten on paste** with `Select-String -Pattern "<a"` before building any file with anchor tags.
- **Run forbidden-phrase grep before deploy:**
```powershell
  Get-ChildItem -Path lib,app,components -Recurse -Include *.ts,*.tsx | Select-String -Pattern "AI website","AI-built","AI generated","generated website","built with AI" -SimpleMatch
```
- **Recommended first task next session:** ask Claude to read through the repo and produce `docs/replicant-sites/architecture.md` — system map, directory tour, data flows, integrations, brain logic, conventions, glossary.

---

## Forbidden phrases (never in public copy)

- AI website
- AI-built / AI-built website
- AI generated / AI-generated website
- generated website
- built with AI

The one match for "AI-built" / "AI-generated" in `lib/brain/index.ts` is the LLM system prompt explicitly *forbidding* those phrases — that's correct code, not a violation. Mentally exclude that line when grepping.