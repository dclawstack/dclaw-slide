"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";

import {
  api,
  ApiError,
  type AnalyticsEventType,
  type Presentation,
  type Theme,
} from "@/lib/api";
import { SlideCanvas } from "@/components/slide-canvas";

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function PublicSharePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [index, setIndex] = useState(0);

  const sessionId = useMemo(newSessionId, []);
  const slideEnterMs = useRef<number>(Date.now());

  const slide = presentation?.slides[index];

  const load = useCallback(
    async (pw?: string) => {
      if (!token) return;
      try {
        const result = await api.publicShare(token, pw);
        setPresentation(result.presentation);
        setNeedsPassword(false);
        setError(null);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setNeedsPassword(true);
        } else {
          setError(e instanceof ApiError ? e.message : "Failed to load share");
        }
      }
    },
    [token],
  );

  useEffect(() => {
    load();
  }, [load]);

  const recordEvent = useCallback(
    async (event_type: AnalyticsEventType, dwell_ms = 0, slide_id?: string) => {
      if (!presentation) return;
      try {
        await api.recordAnalytics(presentation.id, {
          session_id: sessionId,
          event_type,
          slide_id,
          dwell_ms,
        });
      } catch {
        /* analytics must never break the viewer */
      }
    },
    [presentation, sessionId],
  );

  useEffect(() => {
    if (!slide) return;
    slideEnterMs.current = Date.now();
    recordEvent("slide_view", 0, slide.id);
    return () => {
      recordEvent("dwell", Date.now() - slideEnterMs.current, slide.id);
    };
  }, [slide, recordEvent]);

  useEffect(() => {
    if (!presentation) return;
    function onKey(e: KeyboardEvent) {
      if (!presentation) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        if (index < presentation.slides.length - 1) {
          recordEvent("advance", 0, presentation.slides[index]?.id);
          setIndex((i) => i + 1);
        } else {
          recordEvent("finish");
        }
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        if (index > 0) {
          recordEvent("back", 0, presentation.slides[index]?.id);
          setIndex((i) => i - 1);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presentation, index, recordEvent]);

  // Pick the matching theme from the catalog so SlideCanvas can render with it.
  useEffect(() => {
    if (!presentation) return;
    api
      .themes()
      .then((themes) => {
        const t = themes.find((x) => x.id === presentation.theme_id) ?? null;
        setTheme(t);
      })
      .catch(() => undefined);
  }, [presentation]);

  if (needsPassword) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(password);
          }}
          className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-slate-800 p-8 shadow-xl"
        >
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Lock className="h-4 w-4" /> Password required
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            placeholder="Enter password"
            aria-label="Password"
            className="w-full rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-rose-400 focus:outline-none"
          />
          {error && (
            <p className="rounded-md bg-rose-500/20 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold hover:bg-rose-600"
          >
            Unlock
          </button>
        </form>
      </main>
    );
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
      <main className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <p className="text-sm text-slate-400">Loading…</p>
      </main>
    );
  }

  return (
    <main
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: theme?.background ?? "#0F172A" }}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-3 text-xs text-slate-400">
        <span>{presentation.title}</span>
        <span className="font-mono">{index + 1} / {presentation.slides.length}</span>
        <span className="text-slate-500">Shared via DClaw Slide</span>
      </div>

      <div className="flex flex-1 items-center justify-center p-8">
        <div key={slide.id} className="w-full max-w-6xl animate-fade-scale-in">
          <SlideCanvas
            slide={slide}
            index={index}
            total={presentation.slides.length}
            theme={theme}
            variant="full"
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-6 py-3 text-xs text-slate-400">
        <button
          onClick={() => {
            if (index === 0 || !presentation) return;
            recordEvent("back", 0, presentation.slides[index]?.id);
            setIndex((i) => i - 1);
          }}
          disabled={index === 0}
          className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1 hover:bg-white/10 disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>
        <span className="text-slate-500">Arrow keys to navigate</span>
        <button
          onClick={() => {
            if (!presentation) return;
            if (index < presentation.slides.length - 1) {
              recordEvent("advance", 0, presentation.slides[index]?.id);
              setIndex((i) => i + 1);
            } else {
              recordEvent("finish");
            }
          }}
          className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1 hover:bg-white/10"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </main>
  );
}
