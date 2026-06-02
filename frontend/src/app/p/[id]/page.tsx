"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Download,
  MessageSquare,
  Play,
  Share2,
  Trash2,
  Users,
  Wand2,
  X,
} from "lucide-react";

import {
  api,
  ApiError,
  presentationSocket,
  type AnalyticsSummary,
  type BrandKit,
  type ExportFormat,
  type Presentation,
  type ShareLink,
  type Slide,
  type Theme,
} from "@/lib/api";
import { useToast } from "@/components/providers";
import { GripVertical, Plus } from "lucide-react";
import { SlideCanvas } from "@/components/slide-canvas";
import { SlideCardSkeleton } from "@/components/skeleton";

function newUserId(): string {
  if (typeof window === "undefined") return "anon";
  const cached = sessionStorage.getItem("dclaw-user-id");
  if (cached) return cached;
  const id = "user-" + Math.random().toString(36).slice(2, 8);
  sessionStorage.setItem("dclaw-user-id", id);
  return id;
}

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
  const searchParams = useSearchParams();
  const id = params?.id;
  const refsUsed = Number(searchParams?.get("refs") ?? 0);
  const toast = useToast();

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [outline, setOutline] = useState(DEFAULT_OUTLINE);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [notesPanel, setNotesPanel] = useState<{
    slideId: string;
    notes: string;
    likely_questions: string[];
    provider: string;
  } | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [presence, setPresence] = useState<string[]>([]);

  const userId = useMemo(newUserId, []);

  const refetchDeck = useCallback(async () => {
    if (!id) return;
    try {
      const deck = await api.getPresentation(id);
      setPresentation(deck);
    } catch {
      /* ignore — UI keeps last good state */
    }
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [deck, ts, kit, summary, link] = await Promise.all([
        api.getPresentation(id),
        api.themes(),
        api.getBrandKit(),
        api.analyticsSummary(id),
        api.getShareLink(id),
      ]);
      setPresentation(deck);
      setThemes(ts);
      setBrandKit(kit);
      setAnalytics(summary);
      setShareLink(link);
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Failed to load presentation", "error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: presence + invalidate broadcast.
  useEffect(() => {
    if (!id) return;
    const socket = presentationSocket(id, userId, (event) => {
      if (event.event === "presence") {
        setPresence(event.users);
      } else if (event.event === "invalidate") {
        refetchDeck();
      }
    });
    return () => {
      socket?.close();
    };
  }, [id, userId, refetchDeck]);

  const theme = themes.find((t) => t.id === presentation?.theme_id);
  const accent = brandKit?.accent_color || theme?.accent || "#EC4899";

  async function handleAutoLayout() {
    if (!id) return;
    setBusy(true);
    try {
      const updated = await api.autoLayout(id);
      setPresentation(updated);
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Auto-layout failed", "error");
    } finally {
      setBusy(false);
    }
  }

  function downloadExport(format: ExportFormat) {
    if (!id) return;
    window.open(api.exportUrl(id, format), "_blank");
  }

  async function handleCreateShareLink(password: string, expiresInDays: number | null) {
    if (!id) return;
    try {
      const link = await api.createShareLink(id, {
        password,
        expires_in_days: expiresInDays,
      });
      setShareLink(link);
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Share failed", "error");
    }
  }

  async function handleRevokeShareLink() {
    if (!id) return;
    try {
      await api.revokeShareLink(id);
      setShareLink(null);
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Revoke failed", "error");
    }
  }

  async function generateNotes(slide: Slide) {
    setNotesFor(slide.id);
    try {
      const result = await api.generateSpeakerNotes(slide.id, true);
      setNotesPanel({
        slideId: slide.id,
        notes: result.notes,
        likely_questions: result.likely_questions,
        provider: result.provider,
      });
      setPresentation((prev) =>
        prev
          ? {
              ...prev,
              slides: prev.slides.map((s) =>
                s.id === slide.id ? { ...s, speaker_notes: result.notes } : s,
              ),
            }
          : prev,
      );
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Notes generation failed", "error");
    } finally {
      setNotesFor(null);
    }
  }

  async function handleApplyOutline() {
    if (!id) return;
    setBusy(true);
    try {
      const updated = await api.applyOutline(id, outline, true);
      setPresentation(updated);
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Outline failed", "error");
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
      toast.push(e instanceof ApiError ? e.message : "Rename failed", "error");
    }
  }

  async function handleThemeChange(nextThemeId: string) {
    if (!id) return;
    try {
      const updated = await api.updatePresentation(id, { theme_id: nextThemeId });
      setPresentation(updated);
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Theme change failed", "error");
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
      toast.push(e instanceof ApiError ? e.message : "Slide update failed", "error");
    }
  }

  async function reorderTo(slideId: string, beforeId: string | null) {
    if (!id || !presentation) return;
    const ids = presentation.slides.map((s) => s.id);
    const from = ids.indexOf(slideId);
    if (from === -1 || slideId === beforeId) return;
    ids.splice(from, 1);
    const insertAt = beforeId === null ? ids.length : ids.indexOf(beforeId);
    ids.splice(insertAt, 0, slideId);
    // Optimistic update so the UI doesn't flicker mid-drag.
    setPresentation((prev) =>
      prev
        ? {
            ...prev,
            slides: ids
              .map((sid, idx) => {
                const original = prev.slides.find((s) => s.id === sid);
                return original ? { ...original, position: idx } : null;
              })
              .filter((s): s is Slide => s !== null),
          }
        : prev,
    );
    try {
      const updated = await api.reorderSlides(id, ids);
      setPresentation((prev) =>
        prev ? { ...prev, slides: updated.sort((a, b) => a.position - b.position) } : prev,
      );
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Reorder failed", "error");
      await load();
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
      toast.push(e instanceof ApiError ? e.message : "Reorder failed", "error");
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
      toast.push(e instanceof ApiError ? e.message : "Delete failed", "error");
    }
  }

  async function addBlankSlide() {
    if (!id) return;
    try {
      const slide = await api.createSlide(id, {
        title: "New slide",
        body: "",
        layout: "title-bullets",
      });
      setPresentation((prev) =>
        prev ? { ...prev, slides: [...prev.slides, slide] } : prev,
      );
      setSelectedSlideId(slide.id);
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Add slide failed", "error");
    }
  }

  async function deleteDeck() {
    if (!id || !presentation) return;
    if (!confirm(`Delete "${presentation.title}"? This cannot be undone.`)) return;
    try {
      await api.deletePresentation(id);
      router.push("/dashboard");
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Delete failed", "error");
    }
  }

  if (!presentation) {
    return (
      <main className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto h-14 max-w-6xl px-6" />
        </header>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="h-9 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-slate-100" />
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SlideCardSkeleton key={i} />
            ))}
          </div>
        </div>
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
          <div className="flex items-center gap-2">
            {presence.length > 1 && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700"
                title={presence.join(", ")}
              >
                <Users className="h-3.5 w-3.5" /> {presence.length} online
              </span>
            )}
            <button
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
            <button
              onClick={handleAutoLayout}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              title="Re-pick the best layout for every slide"
            >
              <Wand2 className="h-3.5 w-3.5" /> Auto-layout
            </button>
            <Link
              href={`/p/${id}/present`}
              className="inline-flex items-center gap-1 rounded-md border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
            >
              <Play className="h-3.5 w-3.5" /> Present
            </Link>
            <div className="relative inline-block">
              <details className="group">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
                  <Download className="h-3.5 w-3.5" /> Export
                </summary>
                <div className="absolute right-0 z-10 mt-1 w-32 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                  {(["pdf", "pptx", "html"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => downloadExport(fmt)}
                      className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    >
                      .{fmt}
                    </button>
                  ))}
                </div>
              </details>
            </div>
            <button
              onClick={deleteDeck}
              className="rounded-md border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
            >
              Delete
            </button>
          </div>
        </div>
      </header>

      {shareOpen && (
        <ShareDialog
          link={shareLink}
          onCreate={handleCreateShareLink}
          onRevoke={handleRevokeShareLink}
          onClose={() => setShareOpen(false)}
        />
      )}

      <div className="mx-auto max-w-6xl px-6 py-8">
        <input
          value={presentation.title}
          onChange={(e) => setPresentation({ ...presentation, title: e.target.value })}
          onBlur={(e) => handleRename(e.target.value)}
          aria-label="Presentation title"
          className="w-full bg-transparent text-3xl font-bold text-slate-900 outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {refsUsed > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
              Built with {refsUsed} brand reference{refsUsed === 1 ? "" : "s"}
            </span>
          )}
          <span>{presentation.slides.length} slides</span>
          <span>·</span>
          <span>Status: {presentation.status}</span>
          <span>·</span>
          <label className="inline-flex items-center gap-2">
            Theme:
            <select
              value={presentation.theme_id}
              onChange={(e) => handleThemeChange(e.target.value)}
              aria-label="Theme"
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

        {analytics && analytics.total_sessions > 0 && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Audience analytics
              </h2>
              <span className="ml-auto text-xs text-slate-400">
                {analytics.total_sessions} session
                {analytics.total_sessions === 1 ? "" : "s"} ·{" "}
                {(analytics.completion_rate * 100).toFixed(0)}% completed
              </span>
            </div>
            <AnalyticsHeatmap summary={analytics} accent={accent} />
          </section>
        )}

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {presentation.slides.length} slide{presentation.slides.length === 1 ? "" : "s"}
            </h2>
            <button
              onClick={() => setOutlineOpen((v) => !v)}
              className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {outlineOpen ? "Hide outline" : "Paste outline"}
            </button>
          </div>

          {outlineOpen && (
            <div className="mb-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs text-slate-500">
                Markdown. Each <code>#</code> heading becomes a new slide. Bullets under it
                become body text. <strong>Existing slides are replaced.</strong>
              </p>
              <textarea
                value={outline}
                onChange={(e) => setOutline(e.target.value)}
                aria-label="Outline markdown"
                className="h-60 w-full resize-y rounded-lg border border-slate-300 p-3 font-mono text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
              />
              <button
                onClick={handleApplyOutline}
                disabled={busy}
                className="w-full rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
              >
                {busy ? "Building…" : "Build slides from outline"}
              </button>
            </div>
          )}

          {presentation.slides.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
              No slides yet — click <strong>Paste outline</strong> above or use{" "}
              <strong>+ Add slide</strong> below.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {presentation.slides.map((slide, idx) => (
              <div
                key={slide.id}
                draggable
                onDragStart={(e) => {
                  setDragId(slide.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", slide.id);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setDragOverId(null);
                }}
                onDragOver={(e) => {
                  if (!dragId || dragId === slide.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverId(slide.id);
                }}
                onDragLeave={() => {
                  if (dragOverId === slide.id) setDragOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId && dragId !== slide.id) reorderTo(dragId, slide.id);
                  setDragId(null);
                  setDragOverId(null);
                }}
                onClick={() => setSelectedSlideId(slide.id)}
                role="button"
                tabIndex={0}
                aria-label={`Edit slide ${idx + 1}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedSlideId(slide.id);
                  }
                }}
                className={`group cursor-pointer rounded-2xl border bg-white p-3 shadow-sm transition hover:border-rose-300 hover:shadow-md ${
                  selectedSlideId === slide.id ? "border-rose-400 ring-2 ring-rose-200" : "border-slate-200"
                } ${dragOverId === slide.id ? "ring-2 ring-rose-300" : ""} ${
                  dragId === slide.id ? "opacity-50" : ""
                }`}
              >
                <SlideCanvas
                  slide={slide}
                  index={idx}
                  total={presentation.slides.length}
                  theme={theme}
                  brandKit={brandKit}
                  variant="thumb"
                />
                <div className="mt-2 flex items-center justify-between px-1 text-xs text-slate-500">
                  <span className="font-mono">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="truncate px-2">{slide.title || "Untitled"}</span>
                  <GripVertical
                    className="h-4 w-4 cursor-grab text-slate-300 group-hover:text-slate-500"
                    aria-label="Drag to reorder"
                  />
                </div>
              </div>
            ))}

            <button
              onClick={addBlankSlide}
              className="flex aspect-[16/9] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white text-slate-500 transition hover:border-rose-400 hover:bg-rose-50/40 hover:text-rose-600"
            >
              <Plus className="h-8 w-8" />
              <span className="text-sm font-medium">Add slide</span>
            </button>
          </div>
        </section>
      </div>

      {selectedSlideId && (
        <SlideEditDrawer
          slide={presentation.slides.find((s) => s.id === selectedSlideId) ?? null}
          index={presentation.slides.findIndex((s) => s.id === selectedSlideId)}
          total={presentation.slides.length}
          notesPanel={notesPanel}
          notesFor={notesFor}
          onClose={() => setSelectedSlideId(null)}
          onPatch={patchSlide}
          onDelete={(s) => {
            deleteSlide(s);
            setSelectedSlideId(null);
          }}
          onMove={moveSlide}
          onGenerateNotes={generateNotes}
        />
      )}
    </main>
  );
}

function SlideEditDrawer({
  slide,
  index,
  total,
  notesPanel,
  notesFor,
  onClose,
  onPatch,
  onDelete,
  onMove,
  onGenerateNotes,
}: {
  slide: Slide | null;
  index: number;
  total: number;
  notesPanel: {
    slideId: string;
    notes: string;
    likely_questions: string[];
    provider: string;
  } | null;
  notesFor: string | null;
  onClose: () => void;
  onPatch: (slide: Slide, patch: Partial<Slide>) => void;
  onDelete: (slide: Slide) => void;
  onMove: (slide: Slide, direction: -1 | 1) => void;
  onGenerateNotes: (slide: Slide) => void;
}) {
  if (!slide) return null;
  const showQuestions = notesPanel?.slideId === slide.id;
  return (
    <div
      className="fixed inset-0 z-40 flex animate-fade-in"
      role="button"
      tabIndex={0}
      aria-label="Close slide editor"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className="flex-1 bg-slate-900/30 backdrop-blur-sm" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-screen w-full max-w-xl animate-slide-in-right flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Slide {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </div>
            <select
              value={slide.layout}
              onChange={(e) => onPatch(slide, { layout: e.target.value })}
              aria-label="Slide layout"
              className="-ml-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-slate-900 hover:border-slate-300 focus:border-rose-500 focus:outline-none"
            >
              <option value="title-only">title-only</option>
              <option value="title-bullets">title-bullets</option>
              <option value="section-header">section-header</option>
              <option value="quote">quote</option>
              <option value="two-column">two-column</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onMove(slide, -1)}
              disabled={index === 0}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              title="Move up"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => onMove(slide, 1)}
              disabled={index === total - 1}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              title="Move down"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              onClick={() => onGenerateNotes(slide)}
              disabled={notesFor === slide.id}
              className="rounded p-1 text-rose-500 hover:bg-rose-50 disabled:opacity-50"
              title="Generate speaker notes (AI)"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(slide)}
              className="rounded p-1 text-rose-500 hover:bg-rose-50"
              title="Delete slide"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="ml-2 rounded p-1 text-slate-500 hover:bg-slate-100"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-5 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Title
            </label>
            <input
              key={`title-${slide.id}`}
              defaultValue={slide.title}
              onBlur={(e) =>
                e.target.value !== slide.title && onPatch(slide, { title: e.target.value })
              }
              placeholder="Slide title"
              aria-label="Slide title"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-semibold text-slate-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Body — one bullet per line, prefix with <code>-</code>
            </label>
            <textarea
              key={`body-${slide.id}`}
              defaultValue={slide.body}
              onBlur={(e) =>
                e.target.value !== slide.body && onPatch(slide, { body: e.target.value })
              }
              placeholder="- Bullet one&#10;- Bullet two"
              aria-label="Slide body"
              rows={Math.max(6, (slide.body.match(/\n/g)?.length ?? 0) + 2)}
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Speaker notes
            </label>
            <textarea
              key={`notes-${slide.id}`}
              defaultValue={slide.speaker_notes}
              onBlur={(e) =>
                e.target.value !== slide.speaker_notes &&
                onPatch(slide, { speaker_notes: e.target.value })
              }
              placeholder="What you'll say while this slide is up…"
              aria-label="Speaker notes"
              rows={4}
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
            />
          </div>
          {showQuestions && notesPanel && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-sm text-slate-700">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-rose-700">
                Likely audience questions · {notesPanel.provider}
              </div>
              <ul className="space-y-1">
                {notesPanel.likely_questions.map((q, i) => (
                  <li key={i}>• {q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function ShareDialog({
  link,
  onCreate,
  onRevoke,
  onClose,
}: {
  link: ShareLink | null;
  onCreate: (password: string, expiresInDays: number | null) => Promise<void>;
  onRevoke: () => Promise<void>;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number | "">("");
  const [busy, setBusy] = useState(false);

  const shareUrl =
    typeof window !== "undefined" && link
      ? `${window.location.origin}/s/${link.token}`
      : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Share this deck</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {link ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Public link
              </div>
              <div className="mt-1 flex gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  aria-label="Public share link"
                  className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
                />
                <button
                  onClick={() => navigator.clipboard?.writeText(shareUrl)}
                  className="rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
                >
                  Copy
                </button>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {link.has_password ? "🔒 Password required · " : ""}
                {link.expires_at
                  ? `Expires ${new Date(link.expires_at).toLocaleDateString()} · `
                  : "Never expires · "}
                {link.view_count} views
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  setBusy(true);
                  await onCreate(password, expiresInDays === "" ? null : expiresInDays);
                  setBusy(false);
                }}
                disabled={busy}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 disabled:opacity-50"
              >
                Rotate link
              </button>
              <button
                onClick={async () => {
                  setBusy(true);
                  await onRevoke();
                  setBusy(false);
                }}
                disabled={busy}
                className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              await onCreate(password, expiresInDays === "" ? null : expiresInDays);
              setBusy(false);
            }}
            className="space-y-4"
          >
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Password (optional)
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank for no password"
                aria-label="Password (optional)"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Expires in (days)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={expiresInDays}
                onChange={(e) =>
                  setExpiresInDays(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="Never expires"
                aria-label="Expires in (days)"
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-rose-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create share link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function AnalyticsHeatmap({
  summary,
  accent,
}: {
  summary: AnalyticsSummary;
  accent: string;
}) {
  const max = Math.max(1, ...summary.slides.map((s) => s.average_dwell_ms));
  return (
    <ul className="space-y-2">
      {summary.slides.map((slide) => {
        const ratio = max > 0 ? slide.average_dwell_ms / max : 0;
        return (
          <li key={slide.slide_id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 text-xs">
            <span className="font-mono text-slate-400">{slide.position + 1}.</span>
            <div className="relative h-6 overflow-hidden rounded-md bg-slate-100">
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${Math.max(2, ratio * 100)}%`,
                  backgroundColor: accent,
                  opacity: 0.7,
                }}
              />
              <span className="absolute inset-0 flex items-center px-3 text-slate-700">
                {slide.title}
              </span>
            </div>
            <span className="font-mono text-slate-500">
              {Math.round(slide.average_dwell_ms / 1000)}s · {slide.views} views
              {slide.dropoffs > 0 && (
                <span className="ml-2 text-rose-500">{slide.dropoffs} drop</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
