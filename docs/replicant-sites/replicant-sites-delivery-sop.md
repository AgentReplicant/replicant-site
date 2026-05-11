# Replicant Sites — Delivery SOP

**Purpose:** The standard process for delivering a service-business website from first contact to launch. Follow this end-to-end for every build so quality stays consistent and nothing gets dropped.

**Use it like this:** Each phase has a goal, the actions to take, and what "done" looks like. Don't skip phases — they exist because someone (you) once skipped one and paid for it later.

---

## Phase 0 — Lead Comes In

**Goal:** Decide whether this lead is worth a call.

**Actions:**
- Audit lead lands in Airtable from `/website-audit`
- Review: Business Category, Main Goal, Budget Range, Timeline
- Skim the Business Details / Main Problem fields for red flags or green flags

**Disqualify if:**
- Budget under $500 *and* expectations are champagne-tier
- "Just exploring" + no real business yet
- Vague answers across the board (suggests low commitment)

**Move forward if:**
- Clear business identity (name, services, real photos exist or could exist)
- Realistic timeline
- Budget aligns with at least the Starter tier, OR they're a strategic exception (referral, beta, portfolio fit)

**Done when:** Lead is marked `Contacted` or `Lost` in Airtable.

---

## Phase 1 — Audit Response

**Goal:** Send the lead a short, useful audit reply that earns a call.

**Actions:**
- Look at their current website (if any) on desktop AND mobile
- Look at their Instagram / social link
- Look at their booking flow if linked
- Fill out the audit response template (see `replicant-sites-audit-response-template.md` once it exists)
- Send via email or DM — whichever channel they listed as preferred

**Done when:** Audit reply sent and lead status updated to `Audit Sent`.

---

## Phase 2 — Discovery Call

**Goal:** Confirm scope, confirm budget, confirm fit. Pitch the right package.

**Actions:**
- 15–25 minute call, not longer
- Listen first — what's their actual pain
- Walk through their current online presence on screen-share if possible
- Recommend a tier (Starter / Booking-Quote / Site + Assistant)
- Quote starting-at price; confirm budget alignment
- Ask if they're ready to move forward or need to think it over
- Set next step before hanging up (proposal, intake, or follow-up date)

**Done when:** Call happened, next step is set, Airtable status is `Call Booked` → moved to `Proposal Sent` after the call.

---

## Phase 3 — Intake Sent

**Goal:** Hand off the intake checklist and set the expectation that nothing gets built until it comes back.

**Actions:**
- Duplicate `replicant-sites-intake-checklist.md` master into `client-builds/[business-name]/intake.md`
- Send the Word doc version (`Replicant Sites - Client Intake Checklist.docx`) via their preferred channel
- Send a short message: "Once this comes back filled out and you've gathered your photos, I'll get started."

**No assets, no build. No exceptions.**

**Done when:** Intake delivered to client.

---

## Phase 4 — Intake Review & Asset Collection

**Goal:** Have everything you need before opening the code editor.

**Actions:**
- Read the filled intake carefully
- Flag anything missing, unclear, or contradictory
- Send a single follow-up message listing exactly what's still needed (not five separate texts over a week)
- Receive and organize assets into `client-builds/[business-name]/assets/`:
  - `logo/`
  - `work-photos/`
  - `owner-team/`
  - `location/`
  - `before-after/` (if applicable)
- Rename files so they're useful (`hero-1.jpg`, not `IMG_20451.jpg`)
- Note any assets that are low-quality or unusable — request replacements

**Done when:**
- Intake is fully filled out
- All required assets are collected and organized
- You can write the entire site content from what's in front of you, without guessing

---

## Phase 5 — Scope Confirmation

**Goal:** Lock the scope before building. Avoid mid-build surprises.

**Actions:**
- Confirm in writing (text/email is fine): tier chosen, page sections included, what's NOT included, revision rounds, timeline estimate
- For beta clients: send `Replicant Sites - Beta Client Scope Note.docx`
- For paid clients: send the proposal/scope email (formalize this later as a separate doc)
- Wait for explicit "sounds good" / "yes go" before starting

**Done when:** Client has confirmed scope in writing.

---

## Phase 6 — Site Structure Planning

**Goal:** Decide the site structure before designing anything.

**Actions:**
- Sketch (paper, Figma, or just a markdown bullet list) the page sections in order
- For a typical service-business site: Hero → Services → Gallery → Booking/Quote CTA → About → Reviews → Location/Hours → Policies → FAQ → Footer
- Identify which sections this client actually needs vs. can skip
- Map the customer's primary path: what do you want a visitor to do first? Second?
- Note any custom sections this client needs (e.g., a med spa probably wants a consultation request flow)

**Done when:** You have a clear section list and a clear primary CTA path.

---

## Phase 7 — Build

**Goal:** Translate the intake + assets into the actual site.

**Actions:**
- Start from the Beauty & Grooming starter template (or whichever vertical matches)
- Replace placeholder copy with real client content from intake
- Drop in real photos
- Wire up booking link / phone / contact form / quote form
- Set brand colors per intake
- Build mobile-first: every section needs to look right on a phone before you optimize desktop
- Use service-business-appropriate visuals — clean, premium, not corporate-startup

**Don't:**
- Don't get fancy with animations or effects unless the client specifically wants that style
- Don't add features the intake didn't request
- Don't build custom booking flows when their existing platform link works fine

**Done when:** Site is feature-complete on staging/preview URL.

---

## Phase 8 — Mobile QA

**Goal:** Catch mobile-specific issues before the client sees them.

**Actions:**
- Test on real iPhone Safari (not just Chrome DevTools mobile view)
- Test on real Android Chrome
- Tap every button, link, form submit, and booking CTA
- Check that nothing overflows horizontally
- Check that text is readable (not too tight, not too tiny)
- Check that hero loads fast on mobile data, not just wifi

**Done when:** Site works flawlessly on at least one iPhone and one Android device.

---

## Phase 9 — Booking & Contact Flow Testing

**Goal:** Make sure customers can actually do what the site asks them to do.

**Actions:**
- Click the booking link from a phone — does it open the booking platform correctly?
- Test the contact form with a real submission — does the lead arrive in Airtable / email / wherever it's supposed to?
- Click the phone number on mobile — does it open the dialer?
- Click the email link — does it open the mail app?
- Click social links — do they open the right profiles?
- If there's a quote request flow — submit a test quote, confirm it lands

**Done when:** Every action the site invites a customer to take has been tested end-to-end with a real submission.

---

## Phase 10 — SEO Basics

**Goal:** The site should show up correctly when someone Googles the business name.

**Actions:**
- Set page title: `[Business Name] — [Service] in [City]`
- Set meta description (1–2 sentences, mention the city and primary service)
- Set Open Graph image (works for link previews when shared)
- Set favicon (use logo or a clean derivative)
- Make sure headings (H1, H2) describe the business and services in plain language
- Add the business to Google Search Console (if you're managing SEO)
- Submit sitemap if applicable

**Done when:** Page title, meta description, OG image, and favicon are all set.

---

## Phase 11 — Client Review

**Goal:** Get client eyes on the site before launch.

**Actions:**
- Send preview URL with a short, focused message:
  - "Here's the site. Please review and let me know any specific changes within the agreed revision rounds."
- Encourage them to view on their phone, since their customers will
- Ask them to test the booking flow themselves
- Set a deadline for feedback (e.g., 3 business days), or it stalls forever

**Done when:** Client has sent revision notes OR approved as-is.

---

## Phase 12 — Revisions

**Goal:** Apply agreed revisions, hold the line on scope creep.

**Actions:**
- Apply requested changes within the agreed revision rounds (1–2 for beta, define explicitly for paid)
- If a request is out of scope (logo redesign, custom new feature, etc.), respond clearly:
  - "Happy to do that — that's outside our current scope, so I'd quote that separately."
- Don't quietly absorb extra work. That's how free projects eat your weekends.

**Done when:** Revisions are applied and client has signed off.

---

## Phase 13 — Domain Connection

**Goal:** Site goes live on the client's real domain.

**Actions:**
- Confirm domain ownership (client should own it; if you're holding it temporarily, transfer to them)
- Update DNS records (A records, CNAMEs, or follow the hosting platform's instructions)
- Wait for propagation (can be 5 minutes, can be 24 hours — don't panic at hour 2)
- Confirm SSL is active (browser shows the lock icon)
- Test the live URL on mobile AND desktop

**Done when:** The site loads correctly at the client's domain over HTTPS.

---

## Phase 14 — Launch

**Goal:** Hand the site off cleanly.

**Actions:**
- Run the full launch checklist (`replicant-sites-launch-checklist.md`)
- Send the client a launch message with:
  - The live URL
  - A quick "here's what we built" summary
  - Anything they need to know to manage it (e.g., how to update photos later, if applicable)
- Update Airtable status to `Website Delivered`

**Done when:** Site is live, client has been notified, and the launch checklist is fully ticked.

---

## Phase 15 — Post-Launch Follow-Up (Week 1)

**Goal:** Make sure nothing broke in the first week.

**Actions:**
- Send a check-in message 3–7 days after launch
- Ask: "How's it going? Any issues? Are bookings/calls coming through?"
- Fix anything broken without nickel-and-diming
- If they're happy, segue into the testimonial request

**Done when:** Client confirms everything is working as expected.

---

## Phase 16 — Testimonial Request

**Goal:** Capture proof while they're still happy.

**Actions:**
- Send a friendly, direct ask: "Would you be open to a short testimonial about your experience? Just a couple of sentences I can share."
- Make it easy: give them 1–2 prompts ("What problem did this solve for you?" / "What surprised you about the process?")
- Get permission (if not already in intake) to use their business name, screenshots, and quote in your portfolio

**Done when:** Testimonial is collected (or politely declined) and saved to your portfolio folder.

---

## Phase 17 — Replicant Assistant Upsell (Day 30+)

**Goal:** Pitch the assistant add-on when traffic patterns are visible.

**Timing:** Roughly 30 days after launch — enough time for the client to see whether they're getting visitors and what those visitors are asking about.

**Actions:**
- Check in: "How's traffic? Are you getting questions that come up over and over?"
- If yes: this is the assistant pitch moment
- Walk them through what a Replicant assistant could automate based on the FAQs they shared during intake
- Quote add-on pricing
- Update Airtable status to `AI Upsell Offered`

**Don't push it if:**
- They have no traffic yet (no point automating zero conversations)
- They're not getting repeat questions
- They're not the type of business owner who wants more tech in their workflow

**Done when:** Either the assistant is sold (start a new build cycle) or politely passed on (note it, follow up in 90 days).

---

## Definition of Done for the Whole Project

- [ ] Site is live on the client's domain with SSL
- [ ] All booking/contact flows tested end-to-end
- [ ] Launch checklist fully ticked
- [ ] Client has been notified and is happy with the result
- [ ] Testimonial requested
- [ ] Time tracked and friction logged in the internal section of the intake doc
- [ ] Pricing notes updated with what this build actually took (for `replicant-sites-pricing-notes.md`)
- [ ] Airtable status set to `Website Delivered`
- [ ] Assistant upsell scheduled for ~Day 30

That's the loop. Don't skip phases.