"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Palette, Presentation as PresentationIcon, Sparkles, Wand2 } from "lucide-react";

import { api, ApiError, type PresentationSummary, type Theme } from "@/lib/api";

type DeckType = "pitch" | "report" | "training";

export default function Dashboard() {
  const [presentations, setPresentations] = useState<PresentationSummary[] | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Create-empty form
  const [title, setTitle] = useState("");
  const [themeId, setThemeId] = useState("pitch-classic");
  const [creating, setCreating] = useState(false);

  // Copilot form
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSlides, setAiSlides] = useState(8);
  const [aiDeckType, setAiDeckType] = useState<DeckType>("pitch");
  const [aiGenerating, setAiGenerating] = useState(false);

  async function refresh() {
    try {
      const [decks, ts] = await Promise.all([api.listPresentations(), api.themes()]);
      setPresentations(decks);
      setThemes(ts);
      if (ts.length && !ts.some((t) => t.id === themeId)) setThemeId(ts[0].id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load dashboard");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const deck = await api.createPresentation({ title: title.trim(), theme_id: themeId });
      window.location.href = `/p/${deck.id}`;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Create failed");
      setCreating(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setError(null);
    try {
      const result = await api.generateDeck({
        prompt: aiPrompt.trim(),
        target_slides: aiSlides,
        deck_type: aiDeckType,
        theme_id: themeId,
      });
      window.location.href = `/p/${result.presentation.id}`;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Generation failed");
      setAiGenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-slate-900">
            <PresentationIcon className="h-5 w-5 text-rose-500" />
            <span className="font-semibold">DClaw Slide</span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <Link
              href="/brand"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100"
            >
              <Palette className="h-3.5 w-3.5" /> Brand kit
            </Link>
            <span>Workspace: default</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <section className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-rose-500" />
            <h2 className="text-lg font-semibold text-slate-900">AI Copilot</h2>
            <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
              C1.1
            </span>
          </div>
          <p className="text-sm text-slate-600">
            Describe the deck. Pick a length and type. Get a real, editable presentation in seconds.
          </p>
          <form className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto]" onSubmit={handleGenerate}>
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="A 7-slide pitch for an AI presentation tool"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
            />
            <select
              value={aiDeckType}
              onChange={(e) => setAiDeckType(e.target.value as DeckType)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
            >
              <option value="pitch">Pitch</option>
              <option value="report">Report</option>
              <option value="training">Training</option>
            </select>
            <input
              type="number"
              min={3}
              max={16}
              value={aiSlides}
              onChange={(e) => setAiSlides(Math.max(3, Math.min(16, Number(e.target.value) || 8)))}
              className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={aiGenerating || !aiPrompt.trim()}
              className="col-span-full inline-flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50 sm:col-span-1 sm:col-start-3"
            >
              <Sparkles className="h-4 w-4" />
              {aiGenerating ? "Generating…" : "Generate deck"}
            </button>
          </form>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Start blank</h2>
            <p className="mt-1 text-xs text-slate-500">Or paste an outline later in the editor.</p>
            <form className="mt-4 space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Series A Pitch"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Theme
                </label>
                <select
                  value={themeId}
                  onChange={(e) => setThemeId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                >
                  {themes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.cover_emoji} {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={creating || !title.trim()}
                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create empty deck"}
              </button>
            </form>
            {error && (
              <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            )}
          </section>

          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Your decks</h2>
              <span className="text-xs text-slate-500">
                {presentations === null ? "Loading…" : `${presentations.length} total`}
              </span>
            </div>
            {presentations === null ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
                Loading presentations…
              </div>
            ) : presentations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
                No presentations yet. Try the AI Copilot above.
              </div>
            ) : (
              <ul className="space-y-3">
                {presentations.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/p/${p.id}`}
                      className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-rose-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-base font-semibold text-slate-900">{p.title}</div>
                          <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                            {p.theme_id} · {p.slide_count} slides · {p.status}
                          </div>
                        </div>
                        <time className="text-xs text-slate-400">
                          {new Date(p.updated_at).toLocaleDateString()}
                        </time>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
