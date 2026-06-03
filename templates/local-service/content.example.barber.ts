// templates/local-service/content.example.barber.ts
//
// ⚠️ EXAMPLE CONTENT ONLY ⚠️
// This is a fictional barber shop for demonstrating the template shape.
// "FadeZone Barber Studio" is not a real client and this content is not used
// anywhere publicly. Do NOT deploy this as if it were proof-of-product.
//
// When building a real client site, copy TemplatePage.tsx into a new project,
// create a content.ts (drop the .example), and replace all values below.

import type { LocalServiceContent } from "./types";

export const exampleBarberContent: LocalServiceContent = {
  brand: {
    name: "FadeZone Barber Studio",
    tagline: "Sharp cuts. Honest prices. South Florida.",
    primaryColor: "#0ea5e9", // sky-500
  },
  hero: {
    headline: "Book a clean cut in South Florida",
    sub: "Walk-ins welcome. Online booking takes 30 seconds. Cash, card, or Apple Pay.",
    primaryCta: { label: "Book now", href: "#contact" },
    secondaryCta: { label: "See services", href: "#services" },
  },
  services: [
    { title: "Haircut", desc: "Adult cut, hot towel, neck shave.", price: "From $35" },
    { title: "Beard Trim", desc: "Line-up, shape, and finish.", price: "From $20" },
    { title: "Kids Cut", desc: "Patient cuts for ages 5–12.", price: "From $25" },
    { title: "Cut + Beard", desc: "The full reset combo.", price: "From $50" },
  ],
  gallery: {
    mode: "grid",
    items: [
      // Placeholder paths — replace with real client photos.
      { src: "/example/barber-1.jpg", alt: "Fresh fade with line-up" },
      { src: "/example/barber-2.jpg", alt: "Beard sculpt finish" },
      { src: "/example/barber-3.jpg", alt: "Classic side part" },
    ],
  },
  whyChooseUs: [
    { title: "Licensed barbers", desc: "Every chair, every cut." },
    { title: "On-time, every time", desc: "Online booking holds your slot." },
    { title: "Honest prices", desc: "No upcharges, no surprises." },
  ],
  howItWorks: [
    { step: 1, title: "Book online", desc: "Pick a barber, pick a time." },
    { step: 2, title: "Show up", desc: "Walk in 5 minutes early." },
    { step: 3, title: "Look sharp", desc: "Leave ready for the week." },
  ],
  pricing: {
    intro: "Simple pricing. Tip your barber.",
    tiers: [
      { name: "Cut", price: "From $35", bullets: ["Adult haircut", "Hot towel", "Neck shave"] },
      { name: "Cut + Beard", price: "From $50", bullets: ["Everything in Cut", "Beard shape", "Line-up"], highlighted: true },
      { name: "Kids", price: "From $25", bullets: ["Ages 5–12", "Patient experienced barbers"] },
    ],
  },
  reviews: [
    { name: "Mike R.", rating: 5, text: "Best fade I've had in years. In and out in 30 minutes." },
    { name: "Carlos D.", rating: 5, text: "Clean shop, real barbers. Booking is easy too." },
    { name: "Jordan P.", rating: 5, text: "Took my son here — patient with kids, great cut." },
  ],
  faq: [
    { q: "Do you take walk-ins?", a: "Yes, but booking online guarantees your slot." },
    { q: "What payment methods do you accept?", a: "Cash, all major cards, Apple Pay, Cash App." },
    { q: "Where are you located?", a: "Plantation, FL. Plenty of parking." },
  ],
  contact: {
    phone: "(555) 010-0001",
    email: "hello@example.com",
    address: "123 Example Ave, Plantation, FL 33324",
    serviceArea: "Plantation, Davie, Sunrise, Weston",
    hours: "Tue–Sat 10am–7pm, Sun 11am–4pm, Closed Mon",
    bookingLink: "https://example-booksy.example.com/fadezone",
  },
  socials: {
    instagram: "https://instagram.com/example-fadezone",
    googleBusiness: "https://g.page/example-fadezone",
  },
};