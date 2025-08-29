// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0B1220] text-white grid place-items-center p-10">
      <div className="max-w-xl text-center space-y-6">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#4E77FF] to-[#00DBAA]" />
        <h1 className="text-4xl font-semibold">Page not found</h1>
        <p className="text-white/70">
          The page you’re looking for doesn’t exist or may have moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-xl bg-[#00DBAA] px-5 py-3 text-black hover:bg-[#05c79b]"
        >
          Back to homepage
        </Link>
      </div>
    </main>
  );
}
