"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, Trash2 } from "lucide-react";

import {
  api,
  ApiError,
  type Presentation,
  type Slide,
  type Theme,
} from "@/lib/api";

const DEFAULT_OUTLINE = `# Hook
- Why now
- Who this is for

# Problem
- The pain we measured
- Why incumbents miss it

# Solution
- Our wedge
- Demo screenshot

# Why us
- Founding insight
- Why we win

# Ask
- The round
- The use of funds`;

export default function PresentationDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [outline, setOutline] = useState(DEFAULT_OUTLINE);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [deck, ts] = await Promise.all([api.getPresentation(id), api.themes()]);
      setPresentation(deck);
      setThemes(ts);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load presentation");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const theme = themes.find((t) => t.id === presentation?.theme_id);

  async function handleApplyOutline() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.applyOutline(id, outline, true);
      setPresentation(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Outline failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(newTitle: string) {
    if (!id || !presentation) return;
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === presentation.title) return;
    try {
      const updated = await api.updatePresentation(id, { title: trimmed });
      setPresentation(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Rename failed");
    }
  }

  async function handleThemeChange(nextThemeId: string) {
    if (!id) return;
    try {
      const updated = await api.updatePresentation(id, { theme_id: nextThemeId });
      setPresentation(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Theme change failed");
    }
  }

  async function patchSlide(slide: Slide, patch: Partial<Slide>) {
    if (!id) return;
    try {
      await api.updateSlide(id, slide.id, patch);
      setPresentation((prev) =>
        prev
          ? {
              ...prev,
              slides: prev.slides.map((s) => (s.id === slide.id ? { ...s, ...patch } : s)),
            }
          : prev,
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Slide update failed");
    }
  }

  async function moveSlide(slide: Slide, direction: -1 | 1) {
    if (!id || !presentation) return;
    const ids = presentation.slides.map((s) => s.id);
    const idx = ids.indexOf(slide.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= ids.length) return;
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    try {
      const updated = await api.reorderSlides(id, ids);
      setPresentation((prev) =>
        prev ? { ...prev, slides: updated.sort((a, b) => a.position - b.position) } : prev,
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Reorder failed");
    }
  }

  async function deleteSlide(slide: Slide) {
    if (!id) return;
    try {
      await api.deleteSlide(id, slide.id);
      setPresentation((prev) =>
        prev ? { ...prev, slides: prev.slides.filter((s) => s.id !== slide.id) } : prev,
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  async function deleteDeck() {
    if (!id || !presentation) return;
    if (!confirm(`Delete "${presentation.title}"? This cannot be undone.`)) return;
    try {
      await api.deletePresentation(id);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  if (!presentation) {
    return (
      <main className="min-h-screen bg-slate-50 p-12 text-center text-slate-500">
        {error ?? "Loading presentation…"}
      </main>
    );
  }

  return (
    <main
      className="min-h-screen"
      style={{ backgroundColor: theme?.background ?? "#f8fafc" }}
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <button
            onClick={deleteDeck}
            className="rounded-md border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
          >
            Delete deck
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <input
          value={presentation.title}
          onChange={(e) => setPresentation({ ...presentation, title: e.target.value })}
          onBlur={(e) => handleRename(e.target.value)}
          className="w-full bg-transparent text-3xl font-bold text-slate-900 outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>{presentation.slides.length} slides</span>
          <span>·</span>
          <span>Status: {presentation.status}</span>
          <span>·</span>
          <label className="inline-flex items-center gap-2">
            Theme:
            <select
              value={presentation.theme_id}
              onChange={(e) => handleThemeChange(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.cover_emoji} {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        )}

        <section className="mt-6 grid gap-8 lg:grid-cols-[2fr_3fr]">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Paste an outline
            </h2>
            <p className="text-xs text-slate-500">
              Markdown. Each <code>#</code> heading becomes a new slide. Bullets under it become body text.
              Existing slides are replaced.
            </p>
            <textarea
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              className="h-72 w-full resize-y rounded-lg border border-slate-300 p-3 font-mono text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
            />
            <button
              onClick={handleApplyOutline}
              disabled={busy}
              className="w-full rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
            >
              {busy ? "Building…" : "Build slides from outline"}
            </button>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Slides
            </h2>
            {presentation.slides.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
                No slides yet. Paste an outline on the left.
              </div>
            ) : (
              <ol className="space-y-3">
                {presentation.slides.map((slide, idx) => (
                  <li
                    key={slide.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    style={{
                      borderLeft: theme ? `4px solid ${theme.accent}` : undefined,
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        Slide {idx + 1} · {slide.layout}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveSlide(slide, -1)}
                          disabled={idx === 0}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          title="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => moveSlide(slide, 1)}
                          disabled={idx === presentation.slides.length - 1}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          title="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteSlide(slide)}
                          className="rounded p-1 text-rose-500 hover:bg-rose-50"
                          title="Delete slide"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <input
                      defaultValue={slide.title}
                      onBlur={(e) =>
                        e.target.value !== slide.title && patchSlide(slide, { title: e.target.value })
                      }
                      placeholder="Slide title"
                      className="w-full bg-transparent text-lg font-semibold text-slate-900 outline-none"
                    />
                    <textarea
                      defaultValue={slide.body}
                      onBlur={(e) =>
                        e.target.value !== slide.body && patchSlide(slide, { body: e.target.value })
                      }
                      placeholder="Bullets / body"
                      className="mt-2 w-full resize-y bg-transparent text-sm text-slate-600 outline-none"
                      rows={Math.max(3, (slide.body.match(/\n/g)?.length ?? 0) + 1)}
                    />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
