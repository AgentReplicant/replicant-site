// templates/local-service/types.ts
//
// Content schema for the Replicant local-service starter template.
//
// This file defines the shape of a client's site content. Customizing the
// template for a new client = editing a content.ts file with these types.
// Section components read their slice of this object and render accordingly.
//
// Empty arrays should cause the corresponding section to either hide itself
// or render a sensible empty state. Optional fields are truly optional.

export type BrandConfig = {
  /** Business display name, e.g. "FadeZone Barber Studio". */
  name: string;
  /** Short tagline shown near the brand mark when applicable. */
  tagline?: string;
  /** Any CSS color string. Used as the --brand CSS variable across the page. */
  primaryColor: string;
  /** Optional logo path (relative to public/), e.g. "/logo.svg". */
  logo?: string;
};

export type CTALink = {
  label: string;
  /** External URL or local path. */
  href: string;
};

export type HeroContent = {
  headline: string;
  sub: string;
  /** Optional hero background or feature image, relative to public/. */
  image?: string;
  primaryCta: CTALink;
  /** Optional second CTA (e.g. "See services"). */
  secondaryCta?: CTALink;
};

export type ServiceItem = {
  title: string;
  desc: string;
  /** Short price hint like "From $35" — purely informational, not transactional. */
  price?: string;
  /** Optional emoji or short string used as a visual marker. */
  icon?: string;
};

export type GalleryItem = {
  /** Main image path (relative to public/). */
  src: string;
  alt: string;
  /**
   * For before/after mode, this is the "after" image; `before` is the paired
   * "before" image. For grid mode, ignore `before`.
   */
  before?: string;
};

export type GalleryContent = {
  /** "grid" renders src only; "beforeAfter" pairs before+src side-by-side. */
  mode: "grid" | "beforeAfter";
  items: GalleryItem[];
};

export type WhyChooseUsItem = {
  title: string;
  desc: string;
};

export type HowItWorksStep = {
  step: number;
  title: string;
  desc: string;
};

export type PricingTier = {
  name: string;
  /** e.g. "From $150" or "$200". Display-only. */
  price: string;
  /** Short list of what's included. */
  bullets: string[];
  /** If true, visually highlights this tier. */
  highlighted?: boolean;
};

export type PricingContent = {
  /** Optional intro line above the tiers. */
  intro?: string;
  tiers: PricingTier[];
};

export type Review = {
  name: string;
  /** 1-5. */
  rating: number;
  text: string;
};

export type FAQItem = {
  q: string;
  a: string;
};

export type SocialLinks = {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  /** Direct link to the Google Business profile. */
  googleBusiness?: string;
};

export type ContactContent = {
  phone?: string;
  email?: string;
  /** Free-form address line. */
  address?: string;
  /** Free-form service-area description, e.g. "South Florida — Broward + Miami-Dade". */
  serviceArea?: string;
  /** Hours blob, free-form. e.g. "Tue–Sat 10am–7pm". */
  hours?: string;
  /** External booking platform link (Booksy, Square, Acuity, etc.). */
  bookingLink?: string;
  /** External or local quote-request link. */
  quoteLink?: string;
};

/**
 * The full content shape consumed by TemplatePage.tsx.
 *
 * Required: brand, hero, services, contact.
 * Other sections are optional — omit a key to hide that section entirely.
 */
export type LocalServiceContent = {
  brand: BrandConfig;
  hero: HeroContent;
  services: ServiceItem[];
  gallery?: GalleryContent;
  whyChooseUs?: WhyChooseUsItem[];
  howItWorks?: HowItWorksStep[];
  pricing?: PricingContent;
  reviews?: Review[];
  faq?: FAQItem[];
  contact: ContactContent;
  socials?: SocialLinks;
};