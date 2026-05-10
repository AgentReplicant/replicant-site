"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Globe, CalendarCheck2, Bot } from "lucide-react";

const features = [
  {
    icon: Globe,
    title: "Professional Website",
    desc: "A clean, mobile-first site built around your services, photos, location, reviews, and call-to-action.",
  },
  {
    icon: CalendarCheck2,
    title: "Booking or Quote Flow",
    desc: "We connect the path customers already need: booking links, quote forms, consultation requests, phone calls, or contact forms.",
  },
  {
    icon: Bot,
    title: "Optional AI Assistant",
    desc: "Add a Replicant assistant to answer FAQs, qualify leads, recommend the next step, and help customers book or request a quote.",
  },
];

export function Features() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            What Replicant Builds
          </h2>
          <p className="mt-3 text-white/70">
            A focused website system, the booking or quote path your customers
            need, and an optional assistant when you’re ready to upgrade.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              viewport={{ once: true }}
            >
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4E77FF] to-[#00DBAA]">
                    <Icon className="h-5 w-5 text-black" />
                  </div>
                  <CardTitle className="text-white">{title}</CardTitle>
                </CardHeader>
                <CardContent className="text-white/70">{desc}</CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}