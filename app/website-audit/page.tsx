// app/website-audit/page.tsx
import AuditForm from "@/app/ui/AuditForm";
import Footer from "@/components/footer";

export const metadata = {
  title: "Free Website Audit — Replicant",
  description:
    "Request a free website audit for your service business. We review your current online presence and tell you exactly what we'd improve to bring more bookings, calls, or quote requests.",
};

export default function WebsiteAuditPage() {
  return (
    <>
      <section className="relative w-full pt-32 pb-12 md:pt-40 md:pb-16">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.15] tracking-tight text-white">
            Request Your Free Website Audit
          </h1>
          <p className="mt-5 text-base sm:text-lg text-white/70 leading-relaxed">
            Tell us about your business, your current online presence, and what
            you want more of — bookings, calls, consultations, or quote
            requests. We'll review and send back a clear, honest take on what
            we'd improve.
          </p>
        </div>
      </section>

      <section className="pb-24 md:pb-32">
        <div className="mx-auto max-w-3xl px-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8 shadow-lg backdrop-blur">
            <AuditForm />
          </div>

          <p className="mt-6 text-xs text-white/50 text-center">
            We'll only use this info to follow up about your audit. No spam, no
            list-selling, no nonsense.
          </p>
        </div>
      </section>

      <Footer />
    </>
  );
}