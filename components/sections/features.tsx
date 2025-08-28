"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Bot, CalendarCheck2, MessageSquare, ShieldCheck, Waves, Headphones } from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "Conversational AI that sells",
    desc: "Understands intent, handles objections, and routes perfectly."
  },
  {
    icon: CalendarCheck2,
    title: "Calendar booking, done",
    desc: "No back-and-forth. Your agent proposes times and confirms instantly."
  },
  {
    icon: MessageSquare,
    title: "Omni-channel",
    desc: "Voice, SMS, WhatsApp, IG, and web chat from one brain."
  },
  {
    icon: ShieldCheck,
    title: "Compliant and logged",
    desc: "Consent prompts, transcripts, and safe-guards built-in."
  },
  {
    icon: Waves,
    title: "2–3s response target",
    desc: "Fast enough to feel human; tuned for trust and flow."
  },
  {
    icon: Headphones,
    title: "Hand-off when needed",
    desc: "Escalates to a human with context and next-best actions."
  }
];

export function Features() {
  return (
    <section id="features" className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Why teams choose Replicant</h2>
          <p className="mt-3 text-white/70">Everything you need to qualify, schedule, and convert — without adding headcount.</p>
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
