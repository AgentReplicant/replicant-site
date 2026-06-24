export default function CTA() {
  return (
    <div className="mx-auto max-w-4xl text-center">
      <h3 className="text-2xl md:text-3xl font-semibold">
        Ready to bring your service business online?
      </h3>
      <div className="mt-6 flex justify-center gap-3">
        <a href="#chat" className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 font-medium">
          Chat with Riley
        </a>
        <a href="/website-audit" className="rounded-lg bg-white/10 hover:bg-white/20 px-4 py-2 font-medium">
          Start Free Website Audit
        </a>
      </div>
    </div>
  );
}
