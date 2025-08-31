const faqs = [
  {
    q: "Is this just a chatbot?",
    a: "No. It qualifies leads, books meetings, and can drop a checkout link. You get transcripts + lead info.",
  },
  {
    q: "Can I talk to a human?",
    a: "Yes—type “talk to Marlon” in chat and it will escalate.",
  },
  {
    q: "What’s the guarantee?",
    a: "14-day refund on the first month. Cancel any time after.",
  },
  {
    q: "Which channels?",
    a: "Webchat today; WhatsApp, Instagram, and SMS are on the roadmap.",
  },
];

export default function FAQ() {
  return (
    <section className="mx-auto max-w-5xl px-4">
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">FAQ</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {faqs.map((f) => (
          <div key={f.q} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow">
            <h3 className="font-medium">{f.q}</h3>
            <p className="mt-2 text-sm opacity-80">{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
