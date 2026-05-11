# Replicant Sites — Launch Checklist

**Use this right before going live.** Run through every item. If any item fails, fix it before launching. Tick the box when verified.

**Project:** ___________________________
**Launch Date:** ___________________________

---

## Layout & Visuals

### Mobile (iPhone Safari + Android Chrome — test on real devices)
- [ ] Hero displays correctly, headline readable, CTA tappable
- [ ] All sections render in correct order
- [ ] No horizontal scrolling anywhere
- [ ] All images load (no broken image icons)
- [ ] Images are sharp on retina displays (not pixelated)
- [ ] Text is readable — not too small, not too tight, good contrast
- [ ] Buttons are large enough to tap comfortably (no rage-tapping)
- [ ] Nav menu opens and closes properly
- [ ] All sections have appropriate spacing — no cramped or empty-feeling areas

### Desktop
- [ ] Hero looks balanced and intentional
- [ ] No overly wide text columns (lines shouldn't stretch across the whole screen)
- [ ] Hover states work on buttons and links
- [ ] Images don't stretch awkwardly at large viewport sizes
- [ ] Nav stays accessible (sticky or visible at scroll)

---

## Links & Buttons

- [ ] Primary CTA button(s) work and route to the correct destination
- [ ] Secondary CTAs work
- [ ] Booking link opens the correct booking platform (Booksy, Square, Calendly, etc.)
- [ ] Phone number is tappable on mobile (`tel:` link works)
- [ ] Email link opens the mail app (`mailto:` link works)
- [ ] All social links open the correct profiles (Instagram, TikTok, Facebook, etc.)
- [ ] Google Maps / location link opens to the right address
- [ ] No broken links anywhere on the site (ctrl+F for "#" hrefs or empty hrefs)

---

## Forms

- [ ] Contact form / quote form / booking form submits successfully with a test entry
- [ ] Test submission lands in the correct destination (Airtable, email, webhook, etc.)
- [ ] Required fields are actually required (form doesn't submit empty)
- [ ] Success message appears after submission
- [ ] Error message appears if submission fails
- [ ] Form is keyboard-navigable (tab through fields)
- [ ] Form works on mobile without zoom-jumping or layout breaks

---

## Business Information

- [ ] Business name appears correctly everywhere (no typos, consistent capitalization)
- [ ] Services listed with accurate names, descriptions, and prices
- [ ] Address is correct (verify against intake doc)
- [ ] Phone number is correct (verify against intake doc)
- [ ] Email is correct (verify against intake doc)
- [ ] Hours displayed correctly for every day of the week
- [ ] Service area listed (if applicable)
- [ ] Policies present and accurate (cancellation, deposit, no-show, etc.)
- [ ] FAQ answers match what the client told us in intake

---

## SEO Basics

- [ ] Page title is set: `[Business Name] — [Service] in [City]` (or similar pattern)
- [ ] Meta description is set (1–2 sentences, mentions city + primary service)
- [ ] H1 on homepage describes what the business does in plain language
- [ ] H2s break up sections meaningfully
- [ ] Alt text on important images (especially logo and hero photos)
- [ ] Open Graph image set (the preview image when site is shared on social)
- [ ] Open Graph title and description set
- [ ] Favicon set (logo or clean derivative)
- [ ] robots.txt allows indexing (no accidental `Disallow: /`)
- [ ] Sitemap exists (if Next.js or framework generates one)

---

## Domain & Hosting

- [ ] Custom domain is connected (not still on a `*.vercel.app` or similar staging URL)
- [ ] SSL certificate is active — browser shows the padlock icon
- [ ] `https://` works (no mixed content warnings)
- [ ] Non-www redirects to www (or vice versa) — consistent canonical URL
- [ ] Domain ownership is in the client's name (not yours, unless explicitly agreed)

---

## Analytics & Tracking (if applicable)

- [ ] Analytics installed (Plausible, GA4, Vercel Analytics, etc.)
- [ ] Analytics is recording test page views correctly
- [ ] No tracking scripts blocking the page from loading
- [ ] Cookie banner installed if jurisdiction requires it

---

## Performance Sanity Check

- [ ] Homepage loads in under 3 seconds on mobile data (not just wifi)
- [ ] Hero image is optimized (under ~200kb for hero photo)
- [ ] No console errors in browser DevTools
- [ ] Lighthouse score: Performance 80+ on mobile, Accessibility 90+ (good benchmark, not a hard gate)

---

## Final Sign-Off

- [ ] Client has reviewed the staging URL and approved
- [ ] All agreed revisions are applied
- [ ] Launch checklist is fully ticked
- [ ] Backup of final assets saved to `client-builds/[business-name]/final/`
- [ ] Final live URL tested one last time on mobile + desktop

---

## After Launch (within 24 hours)

- [ ] Send client the launch message with live URL
- [ ] Submit sitemap to Google Search Console (if managing SEO)
- [ ] Update Google Business Profile with new website URL (if managing this for client)
- [ ] Take launch screenshots for portfolio
- [ ] Update Airtable status to `Website Delivered`
- [ ] Set reminder for Day 7 check-in
- [ ] Set reminder for Day 30 assistant upsell

---

**If everything above is ticked, you're cleared to launch.**

**If anything is unchecked, ask: can this go live as-is, or is this a blocker?** Be honest. A blocker is anything that would embarrass you if a customer hit it on day one.