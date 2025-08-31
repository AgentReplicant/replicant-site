// app/layout.tsx
import type { ReactNode } from "react";
import "./globals.css";

import Navbar from "../components/navbar";   // components lives at repo root
import ChatWidget from "./ui/ChatWidget";    // ChatWidget is inside /app/ui

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-[#0B0E12] text-white antialiased selection:bg-blue-600/30 selection:text-white">
        {/* subtle radial glow behind everything */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_450px_at_50%_-120px,rgba(56,189,248,0.25),transparent_60%)]"
        />
        <Navbar />
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
