// components/sections/problem.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Search, MapPin, ShieldCheck, Bot } from "lucide-react";

const points = [
  {
    icon: Search,
    title: "Customers shouldn't have to dig",
    desc: "Searching through social media to find your services, hours, or whether your business is still active — that's where you lose them.",
  },
  {
    icon: MapPin,
    title: "Booking and contact should be obvious",
    desc: "Your booking link, quote form, location, and contact info should be one tap away, not buried at the bottom of a feed.",
  },
  {
    icon: ShieldCheck,
    title: "One clean place to trust and act",
    desc: "A real website gives people somewhere to trust you and take the next step — book, call, or request a quote.",
  },
  {
    icon: Bot,
    title: "Capture leads automatically",
    desc: "When you're ready, a Replicant assistant can answer questions and capture leads while you're with another customer.",
  },
];

export default function Problem() {
  return (
    <section className="mx-auto max-w-5xl px-6">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
          Stop Losing Customers Between Interest and Action
        </h2>
        <p className="mt-4 text-white/65 leading-relaxed">
          Most service businesses lose customers in the gap between
          &ldquo;interested&rdquo; and &ldquo;booked.&rdquo; A real website
          closes that gap.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {points.map(({ icon: Icon, title, desc }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            viewport={{ once: true }}
          >
            <Card className="h-full border-white/10 bg-white/[0.03] hover:bg-white/[0.05] hover:border-sky-400/20 hover:shadow-lg hover:shadow-sky-500/5 transition-all duration-300">
              <CardHeader>
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#4E77FF] to-[#00DBAA] shadow-lg shadow-sky-500/10">
                  <Icon className="h-5 w-5 text-black" />
                </div>
                <CardTitle className="text-white text-lg">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-white/70 leading-relaxed">
                {desc}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}