// app/components/navbar.tsx
"use client";
import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0B0E12]/70 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight text-white">
          Replicant
        </Link>

        <div className="flex items-center gap-6">
          <Link href="/#features" className="text-sm text-slate-300 hover:text-white">
            See Features
          </Link>
          <Link
            href="/#get-started"
            className="inline-flex items-center rounded-xl bg-white px-3 py-1.5 text-sm font-medium text-[#0B0E12] shadow ring-1 ring-white/10 hover:bg-slate-100 active:scale-[0.99] transition"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}
