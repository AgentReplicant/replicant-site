// app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Replicant — AI Sales Agents That Close Deals For You",
  description:
    "Replicant qualifies, books, and converts leads across voice, SMS, and chat — while you focus on fulfillment.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  openGraph: {
    title: "Replicant — AI Sales Agents",
    description:
      "Qualify, schedule, and convert with a live AI agent. Voice, SMS, and chat.",
    url: "https://replicantapp.com", // update later when your domain is live
    siteName: "Replicant",
    images: [
      {
        url: "/og.png", // optional: add later
        width: 1200,
        height: 630,
        alt: "Replicant — AI Sales Agents",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Replicant — AI Sales Agents",
    description:
      "Qualify, schedule, and convert with a live AI agent. Voice, SMS, and chat.",
    images: ["/og.png"], // optional
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1220",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#0B1220] text-white antialiased">{children}</body>
    </html>
  );
}
