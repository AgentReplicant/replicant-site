import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/10 py-10 text-white/70">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 lg:flex-row lg:px-8">
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-block h-6 w-6 rounded-md bg-gradient-to-br from-[#4E77FF] to-[#00DBAA]" />
          <span>Replicant © {new Date().getFullYear()}</span>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
          <Link href="/terms" className="hover:text-white">Terms</Link>
          <Link href="/lead" className="hover:text-white">Contact</Link>
        </nav>
      </div>
    </footer>
  );
}
