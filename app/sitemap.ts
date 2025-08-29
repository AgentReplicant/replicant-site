// app/sitemap.ts
import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://replicant-site.vercel.app"; // update when your domain goes live

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${siteUrl}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/terms`,   lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/success`, lastModified, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/cancel`,  lastModified, changeFrequency: "monthly", priority: 0.2 },
    // add more routes as you create them (e.g., /lead)
  ];
}
