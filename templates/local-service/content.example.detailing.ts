// templates/local-service/content.example.detailing.ts
//
// ⚠️ EXAMPLE CONTENT ONLY ⚠️
// This is a fictional car detailing business for demonstrating that the same
// template works across different local-service verticals. "ShineRight Mobile
// Detailing" is not a real client and this content is not used anywhere
// publicly. Do NOT deploy this as if it were proof-of-product.

import type { LocalServiceContent } from "./types";

export const exampleDetailingContent: LocalServiceContent = {
  brand: {
    name: "ShineRight Mobile Detailing",
    tagline: "We come to you. Your car leaves looking new.",
    primaryColor: "#16a34a", // green-600
  },
  hero: {
    headline: "Mobile detailing that makes your car look new again",
    sub: "Interior, exterior, ceramic coatings, and full details — we come to your home or office.",
    primaryCta: { label: "Request a quote", href: "#contact" },
    secondaryCta: { label: "See services", href: "#services" },
  },
  services: [
    { title: "Interior Detail", desc: "Vacuum, shampoo, leather treatment, full interior reset.", price: "From $120" },
    { title: "Exterior Wash & Wax", desc: "Hand wash, clay bar, polish, wax finish.", price: "From $90" },
    { title: "Full Detail", desc: "Inside and out. The complete reset.", price: "From $200" },
    { title: "Ceramic Coating", desc: "Long-term paint protection. Quote on inspection." },
  ],
  gallery: {
    mode: "beforeAfter",
    items: [
      // Placeholder paths — replace with real client photos.
      { src: "/example/detail-after-1.jpg", before: "/example/detail-before-1.jpg", alt: "Interior reset" },
      { src: "/example/detail-after-2.jpg", before: "/example/detail-before-2.jpg", alt: "Exterior polish" },
      { src: "/example/detail-after-3.jpg", before: "/example/detail-before-3.jpg", alt: "Full detail" },
    ],
  },
  whyChooseUs: [
    { title: "We come to you", desc: "Home or office. Save the trip." },
    { title: "Professional products", desc: "No grocery-store soap and a dirty rag." },
    { title: "Insured & reliable", desc: "Booked appointments, honest quotes." },
  ],
  howItWorks: [
    { step: 1, title: "Request a quote", desc: "Tell us your car and the package you want." },
    { step: 2, title: "We confirm a time", desc: "Pick a slot that fits your schedule." },
    { step: 3, title: "We come to you", desc: "Park, detail, hand back the keys." },
  ],
  pricing: {
    intro: "Pricing starts here. Final quote depends on size and condition.",
    tiers: [
      { name: "Interior", price: "From $120", bullets: ["Vacuum", "Shampoo", "Leather treatment"] },
      { name: "Full Detail", price: "From $200", bullets: ["Interior + exterior", "Wax finish", "Tire dressing"], highlighted: true },
      { name: "Ceramic", price: "Quote", bullets: ["Multi-year protection", "Booked after inspection"] },
    ],
  },
  reviews: [
    { name: "Anita G.", rating: 5, text: "Came to my office, car looked brand new in 2 hours." },
    { name: "Derek L.", rating: 5, text: "Worth every dollar. Booking was easy." },
    { name: "Sam K.", rating: 5, text: "Got the ceramic — paint still beads water months later." },
  ],
  faq: [
    { q: "Do you really come to my home?", a: "Yes. We bring water and power if needed." },
    { q: "How long does a full detail take?", a: "2–4 hours depending on size and condition." },
    { q: "Do you take deposits?", a: "For ceramic and full details, yes." },
  ],
  contact: {
    phone: "(555) 010-0002",
    email: "hello@example.com",
    serviceArea: "Broward & Miami-Dade County",
    hours: "Mon–Sat 8am–6pm",
    quoteLink: "#contact",
  },
  socials: {
    instagram: "https://instagram.com/example-shineright",
    googleBusiness: "https://g.page/example-shineright",
  },
};