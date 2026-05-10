// components/sections/categories.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Scissors, Sparkles, Wrench } from "lucide-react";

const categories = [
  {
    icon: Scissors,
    title: "Beauty & Grooming",
    desc: "For barbers, braiders, salons, lash techs, nail techs, and beauty pros who need a clean site with services, photos, reviews, and booking.",
    cta: "Build My Booking Site",
  },
  {
    icon: Sparkles,
    title: "Wellness & Aesthetics",
    desc: "For med spas, massage therapists, trainers, fitness coaches, and wellness providers who need trust, consultations, and qualified leads.",
    cta: "Build My Consultation Site",
  },
  {
    icon: Wrench,
    title: "Rugged Local Services",
    desc: "For lawncare, plumbing, pressure washing, handyman work, contractors, cleaning, and other local services that need calls and quote requests.",
    cta: "Build My Quote Site",
  },
];

export default function Categories() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Choose the Website System Built for Your Business
        </h2>
        <p className="mt-3 text-white/70">
          Different industries need different paths to a booked customer. We
          build for the way yours actually works.
        </p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map(({ icon: Icon, title, desc, cta }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            viewport={{ once: true }}
          >
            <Card className="border-white/10 bg-white/5 h-full flex flex-col">
              <CardHeader>
                <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4E77FF] to-[#00DBAA]">
                  <Icon className="h-5 w-5 text-black" />
                </div>
                <CardTitle className="text-white">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-white/70 flex-1 flex flex-col">
                <p className="flex-1">{desc}</p>
                <a
                  href="/get-started"
                  className="mt-6 inline-flex items-center justify-center rounded-lg bg-sky-500 px-4 py-2 text-white text-sm font-medium shadow hover:shadow-lg transition w-full"
                >
                  {cta}
                </a>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}