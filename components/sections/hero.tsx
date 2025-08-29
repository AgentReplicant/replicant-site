import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Hero() {
  return (
    <section className="relative pt-28 pb-16">
      <div className="mx-auto max-w-5xl px-6">
        <h1 className="text-5xl font-semibold leading-tight">
          AI Sales Agents That <span className="text-sky-300">Close Deals</span> For You
        </h1>
        <p className="mt-4 text-white/70 max-w-2xl">
          Replicant qualifies, books, and converts leads across voice, SMS, and chat —
          while you focus on fulfillment. No scripts to write. No calendar ping-pong.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <Link href="#get-started">
            <Button size="lg">Book a Demo</Button>
          </Link>
          <Link href="#get-started">
            <Button size="lg" variant="outline">See Features</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
