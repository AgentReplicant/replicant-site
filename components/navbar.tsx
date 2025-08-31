// app/components/navbar.tsx
export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-black/60 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <a href="/" className="text-sm font-semibold tracking-wide">
          Replicant
        </a>

        <div className="flex items-center gap-6 text-sm">
          <a href="#features" className="opacity-80 hover:opacity-100">
            How it works
          </a>
          <a href="#pricing" className="opacity-80 hover:opacity-100">
            Pricing
          </a>
          <a href="#faq" className="opacity-80 hover:opacity-100">
            FAQ
          </a>
          <a
            href="#get-started"
            className="inline-flex items-center rounded-lg bg-white/10 px-3 py-1.5 font-medium text-white hover:bg-white/20"
          >
            Get Started
          </a>
        </div>
      </nav>
    </header>
  );
}
