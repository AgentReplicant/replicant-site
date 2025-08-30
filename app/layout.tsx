// app/layout.tsx
import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-[#0B0E12] text-white antialiased selection:bg-blue-600/30 selection:text-white">
        {/* subtle radial glow behind everything (static class => no purge issues) */}
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_450px_at_50%_-120px,rgba(56,189,248,0.14),transparent)]" />
        {/* navbar is mounted only here */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        {/* <Navbar /> is imported inside page components; keep this as the single mount */}
        {children}
      </body>
    </html>
  );
}
