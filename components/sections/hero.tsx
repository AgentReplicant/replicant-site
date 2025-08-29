"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// IMPORTANT: @ maps to the repo root, so ChatWidget is at app/ui/ChatWidget.tsx
const LivePreview = dynamic(() => import("@/app/ui/ChatWidget"), {
  ssr: false,
  loading: () => (
    <div className="h-[520px] w-full rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 animate-pulse" />
  ),
});

export default function Hero() {
  return (
    <section className="relative isolate">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_500px_at_center,rgba(56,189,248,0.08),transparent_70%)]" />
      <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="grid grid-cols-12 items-center gap-8">
          {/* Left column */}
          <div className="col-span-12 lg:col-span-6">
            <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
              AI Sales Agents That{" "}
              <span className="text-sky-400">Close Deals</span> For You
            </h1>

            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row">
              <Link href="#get-started">
                <Button size="lg">Book a Demo</Button>
              </Link>
              <Link href="#features" className="text-sky-400">
                See Features
              </Link>
            </div>
          </div>

          {/* Right column */}
          <div className="col-span-12 lg:col-span-6">
            <LivePreview />
          </div>
        </div>
      </div>
    </section>
  );
}
