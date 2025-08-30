"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0e12]/70 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight">Replicant</Link>
        <div className="flex items-center gap-6">
          <Link href="#features" className="text-sm opacity-80 hover:opacity-100">See Features</Link>
          <Link
            href="#get-started"
            className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black hover:opacity-90"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}
