const faqs = [
  {
    q: "Do I need a website if I already use Instagram?",
    a: "Instagram is great for showing your work, but it’s a rented audience. A website gives customers one clean place to see your services, trust you, and book or request a quote — without scrolling through a feed.",
  },
  {
    q: "Can you connect my booking platform?",
    a: "Yes. We integrate with the platform you already use (Square, Booksy, Vagaro, Acuity, Calendly, etc.) so your customers can book straight from the site.",
  },
  {
    q: "Can customers request quotes through the site?",
    a: "Yes. For service businesses that price per job — lawncare, plumbing, pressure washing, contractors — we build a clean quote request flow on the site.",
  },
  {
   q: "Can you work with home & trade service businesses?",
    a: "Absolutely. Lawncare, plumbing, handyman work, cleaning, pressure washing, HVAC, contractors — we build sites focused on calls and quote requests, not just looking pretty.",
  },
  {
    q: "What is the Replicant assistant?",
    a: "It’s an optional add-on. Once your website is live, you can add a Replicant assistant that answers common questions, captures lead details, and helps customers take the next step. It’s an upgrade — not how the website itself is built.",
  },
  {
    q: "Do I need the AI assistant right away?",
    a: "No. Most customers start with just the website and add an assistant later when they’re getting enough traffic that answering questions becomes a bottleneck.",
  },
  {
    q: "How fast can the site go live?",
    a: "Most Starter and Booking/Quote sites go live within about 1–2 weeks once we have your business info, photos, and any booking or contact details.",
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