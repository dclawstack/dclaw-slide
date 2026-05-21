"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import {
  api,
  ApiError,
  type AnalyticsEventType,
  type BrandKit,
  type Presentation,
  type Theme,
} from "@/lib/api";

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function PresenterView() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const sessionId = useMemo(newSessionId, []);
  const slideEnterMs = useRef<number>(Date.now());

  const slide = presentation?.slides[index];

  const recordEvent = useCallback(
    async (event_type: AnalyticsEventType, dwell_ms = 0, slide_id?: string) => {
      if (!id) return;
      try {
        await api.recordAnalytics(id, {
          session_id: sessionId,
          event_type,
          slide_id,
          dwell_ms,
        });
      } catch {
        /* swallow — analytics must never break the presenter */
      }
    },
    [id, sessionId],
  );

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [deck, ts, kit] = await Promise.all([
          api.getPresentation(id),
          api.themes(),
          api.getBrandKit(),
        ]);
        setPresentation(deck);
        setThemes(ts);
        setBrandKit(kit);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Failed to load");
      }
    })();
  }, [id]);

  // Record initial slide_view + dwell on transitions.
  useEffect(() => {
    if (!slide) return;
    slideEnterMs.current = Date.now();
    recordEvent("slide_view", 0, slide.id);
    return () => {
      const dwell = Date.now() - slideEnterMs.current;
      recordEvent("dwell", dwell, slide.id);
    };
  }, [slide, recordEvent]);

  // Keyboard nav: arrows, space, escape.
  useEffect(() => {
    if (!presentation) return;
    function onKey(e: KeyboardEvent) {
      if (!presentation) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        exit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentation, index]);

  // On true tab close, flag a dropoff if not finished.
  useEffect(() => {
    function onUnload() {
      if (!presentation) return;
      if (index < presentation.slides.length - 1) {
        navigator.sendBeacon?.(
          `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/presentations/${id}/analytics/event`,
          new Blob(
            [
              JSON.stringify({
                session_id: sessionId,
                event_type: "dropoff",
                slide_id: presentation.slides[index]?.id,
              }),
            ],
            { type: "application/json" },
          ),
        );
      }
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [presentation, index, sessionId, id]);

  function next() {
    if (!presentation) return;
    if (index < presentation.slides.length - 1) {
      recordEvent("advance", 0, presentation.slides[index]?.id);
      setIndex((i) => i + 1);
    } else {
      recordEvent("finish");
    }
  }

  function prev() {
    if (!presentation || index === 0) return;
    recordEvent("back", 0, presentation.slides[index]?.id);
    setIndex((i) => i - 1);
  }

  function exit() {
    if (!presentation) return;
    if (index >= presentation.slides.length - 1) {
      recordEvent("finish");
    } else {
      recordEvent("dropoff", 0, presentation.slides[index]?.id);
    }
    window.location.href = `/p/${id}`;
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-sm text-rose-400">{error}</p>
      </main>
    );
  }

  if (!presentation || !slide) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-sm text-slate-400">Loading…</p>
      </main>
    );
  }

  const theme = themes.find((t) => t.id === presentation.theme_id);
  const accent = brandKit?.accent_color || theme?.accent || "#EC4899";
  const background = theme?.background ?? "#0F172A";
  const isDark = background.toLowerCase() === "#0f172a" || background.toLowerCase() === "#0b0b12";
  const textColor = isDark ? "#F8FAFC" : "#0F172A";
  const subTextColor = isDark ? "#94A3B8" : "#475569";

  const bullets = slide.body
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => (line.startsWith("- ") || line.startsWith("* ") ? line.slice(2) : line));

  return (
    <main
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: background, color: textColor }}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <span className="text-xs uppercase tracking-widest" style={{ color: subTextColor }}>
          {presentation.title}
        </span>
        <span className="font-mono text-xs" style={{ color: subTextColor }}>
          {index + 1} / {presentation.slides.length}
        </span>
        <button
          onClick={exit}
          className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1 text-xs hover:bg-white/10"
          style={{ color: subTextColor }}
        >
          <X className="h-3.5 w-3.5" /> Exit
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-12 py-16">
        <article className="max-w-5xl">
          {slide.layout === "section-header" ? (
            <h1
              className="text-center text-8xl font-bold tracking-tight"
              style={{ color: accent }}
            >
              {slide.title}
            </h1>
          ) : slide.layout === "title-only" ? (
            <div className="text-center">
              <h1 className="text-7xl font-bold" style={{ color: accent }}>
                {slide.title}
              </h1>
              {bullets.length > 0 && (
                <p className="mt-8 text-2xl" style={{ color: subTextColor }}>
                  {bullets.join(" · ")}
                </p>
              )}
            </div>
          ) : slide.layout === "quote" ? (
            <blockquote className="text-center">
              <p
                className="text-5xl font-light italic leading-snug"
                style={{ color: textColor }}
              >
                {slide.body}
              </p>
              <footer className="mt-6 text-lg" style={{ color: subTextColor }}>
                — {slide.title}
              </footer>
            </blockquote>
          ) : slide.layout === "two-column" ? (
            <div>
              <h1 className="mb-10 text-5xl font-bold" style={{ color: accent }}>
                {slide.title}
              </h1>
              <div className="grid grid-cols-2 gap-10">
                {bullets.map((b, i) => (
                  <div
                    key={i}
                    className="rounded-xl border p-6 text-2xl"
                    style={{ borderColor: "rgba(255,255,255,0.1)", color: textColor }}
                  >
                    {b}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <h1 className="mb-8 text-5xl font-bold" style={{ color: accent }}>
                {slide.title}
              </h1>
              <ul className="space-y-4 text-3xl" style={{ color: textColor }}>
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-4">
                    <span style={{ color: accent }}>•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-6 py-3">
        <button
          onClick={prev}
          disabled={index === 0}
          className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1 text-xs hover:bg-white/10 disabled:opacity-30"
          style={{ color: subTextColor }}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>
        <Link
          href={`/p/${id}`}
          className="text-xs underline-offset-2 hover:underline"
          style={{ color: subTextColor }}
        >
          Edit deck
        </Link>
        <button
          onClick={next}
          className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1 text-xs hover:bg-white/10"
          style={{ color: subTextColor }}
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </main>
  );
}
