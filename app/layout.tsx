// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "Replicant — AI Sales Agents",
  description: "AI agents that qualify, book, and convert leads across voice, SMS, and chat.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Force dark mode across the whole app
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        <Navbar />
        <main className="relative">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
