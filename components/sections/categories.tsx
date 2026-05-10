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
    <section className="mx-auto max-w-7xl px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
          Choose the Website System Built for Your Business
        </h2>
        <p className="mt-4 text-white/65 leading-relaxed">
          Different industries need different paths to a booked customer. We
          build for the way yours actually works.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map(({ icon: Icon, title, desc, cta }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            viewport={{ once: true }}
            className="group"
          >
            <Card className="h-full flex flex-col border-white/10 bg-white/[0.03] hover:bg-white/[0.05] hover:border-sky-400/20 hover:shadow-lg hover:shadow-sky-500/5 transition-all duration-300">
              <CardHeader>
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#4E77FF] to-[#00DBAA] shadow-lg shadow-sky-500/10 group-hover:shadow-sky-500/20 transition-shadow">
                  <Icon className="h-5 w-5 text-black" />
                </div>
                <CardTitle className="text-white text-lg">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-white/65 flex-1 flex flex-col">
                <p className="flex-1 text-sm leading-relaxed">{desc}</p>
                <a
                  href="/get-started"
                  className="mt-6 inline-flex items-center justify-center rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-white/90 text-sm font-medium hover:bg-sky-500 hover:border-sky-400 hover:text-white transition w-full"
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