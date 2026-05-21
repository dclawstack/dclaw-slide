import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50">
      <div className="max-w-5xl mx-auto px-6 py-24">
        <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">
          DClaw Slide · v1.0
        </div>
        <h1 className="mt-4 text-5xl font-bold tracking-tight text-slate-900">
          Brand-locked decks. <span className="text-rose-500">Generated in seconds.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          Paste an outline. Pick a theme. DClaw Slide gives you a real presentation
          you can edit, reorder, and ship — all backed by a real API, not a mock.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-rose-600"
          >
            Open the dashboard →
          </Link>
          <a
            href="https://github.com/dclawstack/dclaw-slide"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Source
          </a>
        </div>
      </div>
    </main>
  );
}
