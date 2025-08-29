"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 backdrop-blur supports-[backdrop-filter]:bg-[#0B1220]/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-block h-7 w-7 rounded-lg bg-gradient-to-br from-[#4E77FF] to-[#00DBAA]" />
            <span className="font-semibold tracking-tight">Replicant</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-white/80">
            <Link href="#features" className="hover:text-white">Features</Link>
            <Link href="#how" className="hover:text-white">How it works</Link>
            <Link href="#trust" className="hover:text-white">Trust</Link>
          </nav>

          <div className="flex items-center gap-3">
            {/* Route Sign in to /lead for now to avoid 404s; swap to your real login later */}
            <Button variant="ghost" asChild className="text-white/80 hover:text-white">
              <Link href="/lead">Sign in</Link>
            </Button>

            {/* Primary CTA -> existing lead flow */}
            <Button asChild className="bg-[#4E77FF] hover:bg-[#466cf0] text-white shadow-lg shadow-[#4E77FF]/30">
              <Link href="/lead">Get Started</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
