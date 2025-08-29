import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CTA() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-semibold">Ready to see it in action?</h2>
        <p className="mt-2 text-white/70">
          Tell us about your use case — we’ll reach out and get you set up.
        </p>
        <div className="mt-6">
          <Link href="#get-started">
            <Button size="lg">Get Started</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
