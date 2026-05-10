// components/navbar.tsx
"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { label: "Websites", href: "/#websites" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "AI Assistants", href: "/#ai-assistants" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <a href="/" className="text-lg font-semibold tracking-tight">
          Replicant
        </a>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-white/80">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-white transition">
              {l.label}
            </a>
          ))}
          <a
            href="/get-started"
            className="inline-flex items-center rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-white hover:shadow-lg transition"
          >
            Get Started
          </a>
        </nav>

        {/* Mobile toggle */}
        <button
          aria-label="Toggle menu"
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-white/80 hover:bg-white/10"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/10 bg-black/80">
          <nav className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3 text-sm text-white/90">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="py-1.5 hover:text-white"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <a
              href="/get-started"
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:shadow-lg transition"
              onClick={() => setOpen(false)}
            >
              Get Started
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}