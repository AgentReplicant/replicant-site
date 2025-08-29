"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  return (
    <header className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex h-16 items-center justify-between">
        <Link href="/" className="inline-block">
          <span className="font-semibold tracking-tight">Replicant</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-white/80">
          <Link href="#features" className="hover:text-white">Features</Link>
          <Link href="#how" className="hover:text-white">How it works</Link>
          <Link href="#trust" className="hover:text-white">Trust</Link>
        </nav>

        <div className="flex items-center gap-3">
          {/* Temp “Sign in” can also scroll to form, or leave as /login later */}
          <Button variant="ghost" asChild className="text-white/80 hover:text-white">
            <Link href="#get-started">Sign in</Link>
          </Button>

          {/* Primary CTA → same-page form */}
          <Button asChild className="bg-[#4E77FF] hover:bg-[#406cfo] text-black">
            <Link href="#get-started">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
