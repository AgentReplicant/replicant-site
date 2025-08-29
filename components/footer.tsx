export default function Footer() {
  return (
    <footer className="border-t border-white/10 py-10">
      <div className="mx-auto max-w-6xl px-6 text-sm text-white/60 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} Replicant. All rights reserved.</p>
        <nav className="flex gap-4">
          <a className="hover:text-white/90" href="/privacy">Privacy</a>
          <a className="hover:text-white/90" href="/terms">Terms</a>
        </nav>
      </div>
    </footer>
  );
}
