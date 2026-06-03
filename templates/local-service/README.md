# Replicant — Local Service Template

Reusable starter for service-business websites (barber, detailing, wellness, home/trade, etc.). Internal-only; **this template does not deploy as part of `replicantapp.com`** and contains no real client data.

## What this is

A content-driven website skeleton with these sections:

- Hero
- Services
- Gallery / Before & After
- Why Choose Us
- How It Works
- Pricing / Starting At
- Reviews
- FAQ
- Contact / Booking CTA

All sections read from one typed content object (`LocalServiceContent` in `types.ts`). To customize for a client, you edit one content file and swap photos — no component code changes.

## Files

```txt
templates/local-service/
├── README.md                       ← this file
├── types.ts                        ← content schema (LocalServiceContent + all sub-types)
├── content.example.barber.ts       ← example content for a barber shop (FAKE)
├── content.example.detailing.ts    ← example content for car detailing (FAKE)
├── TemplatePage.tsx                ← assembles all sections; copy to app/page.tsx in a new project
└── components/
    ├── Hero.tsx
    ├── Services.tsx
    ├── Gallery.tsx
    ├── WhyChooseUs.tsx
    ├── HowItWorks.tsx
    ├── Pricing.tsx
    ├── Reviews.tsx
    ├── FAQ.tsx
    └── Contact.tsx
```

## How to build a client site from this template

1. Create a new Next.js project (`npx create-next-app@latest client-{name}`) with Tailwind, TypeScript, and the App Router enabled.
2. Copy this entire `templates/local-service/` directory into the new project, e.g. as `lib/template/`.
3. Move `TemplatePage.tsx` contents into the new project's `app/page.tsx`.
4. Create a real `content.ts` next to the example files. Import from `./content` instead of `./content.example.barber`.
5. Drop client photos into `public/` and update the paths in `content.ts`.
6. Set `content.brand.primaryColor` to the client's brand color (any CSS color string).
7. Run `npm run dev` and verify the site looks right.
8. Deploy as a **separate Vercel project** (not under `replicantapp.com`).
9. Connect the client's custom domain via Vercel dashboard.

## Styling notes

- Tailwind only. No additional styles file.
- Brand color is set as a CSS variable on the page root: `style={{ "--brand": content.brand.primaryColor }}`.
- Section components use Tailwind arbitrary values: `bg-[var(--brand)]`, `text-[var(--brand)]`, `border-[var(--brand)]`.
- For hover states, use `hover:opacity-90` rather than opacity modifiers on the CSS variable (Tailwind's opacity-modifier syntax can be unreliable with CSS variables).

## Optional sections

Any section other than `brand`, `hero`, `services`, and `contact` can be omitted from the content file. The section component will return `null` and the section will not render.

## Examples are NOT proof

`content.example.barber.ts` and `content.example.detailing.ts` exist purely to demonstrate that the same template structure works across different verticals. They are **fictional**, must never be presented as real client work, and are not deployed anywhere public.

## What this template does NOT include

- Public route inside `replicant-site` — this directory is not under `app/` and Next.js will not route it
- Multi-tenancy or per-client config loading
- Airtable integration
- Riley chat widget (future Phase 9 — Web Assistant Product)
- Real client content or proof
- Hardcoded brand themes or per-client styling files