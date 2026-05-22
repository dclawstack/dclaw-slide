"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

import { api, type GenerateDeckInput } from "@/lib/api";
import { SlideCanvas } from "@/components/slide-canvas";
import { SlideCardSkeleton } from "@/components/skeleton";

interface StreamingOverlayProps {
  input: GenerateDeckInput;
  target: number;
  themeAccent?: string;
  onCancel: () => void;
  onDone: (presentationId: string, slidesGenerated: number) => void;
}

interface StreamingSlide {
  id: string;
  position: number;
  title: string;
  body: string;
  layout: string;
}

/** Modal overlay that opens an SSE connection to /generate-deck-stream and
 *  renders slides as they arrive. Closes itself by calling `onDone` once the
 *  stream completes, so the caller can navigate to the new deck. */
export function StreamingOverlay({
  input,
  target,
  themeAccent,
  onCancel,
  onDone,
}: StreamingOverlayProps) {
  const [provider, setProvider] = useState<string | null>(null);
  const [referencesUsed, setReferencesUsed] = useState(0);
  const [slides, setSlides] = useState<StreamingSlide[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = api.generateDeckStream(input, {
      onReady: (data) => {
        setProvider(data.provider);
        setReferencesUsed(data.references_used);
      },
      onSlide: (slide) => {
        setSlides((prev) => [...prev, slide]);
      },
      onDone: (data) => {
        onDone(data.presentation_id, data.slides);
      },
      onError: (msg) => setError(msg),
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = Math.min(slides.length / target, 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-6 animate-fade-in">
      <div className="flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-scale-in">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-rose-500" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {error ? "Generation failed" : `Generating ${target} slides…`}
              </h2>
              <p className="text-xs text-slate-500">
                {provider && (
                  <>
                    {provider}
                    {referencesUsed > 0
                      ? ` · ${referencesUsed} brand reference${referencesUsed === 1 ? "" : "s"} matched`
                      : ""}
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="h-1 w-full bg-slate-100">
          <div
            className="h-full bg-rose-500 transition-all duration-200 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="grid flex-1 grid-cols-2 gap-4 overflow-y-auto p-6 sm:grid-cols-3">
          {slides.map((slide, idx) => (
            <div key={slide.id} className="animate-slide-in-bottom">
              <SlideCanvas
                slide={{
                  ...slide,
                  presentation_id: "",
                  speaker_notes: "",
                  created_at: "",
                  updated_at: "",
                }}
                index={idx}
                total={target}
                variant="thumb"
                theme={themeAccent ? { accent: themeAccent } as never : null}
              />
            </div>
          ))}
          {/* Skeleton placeholders for slides not yet streamed in. */}
          {Array.from({ length: Math.max(0, target - slides.length) }).map((_, i) => (
            <SlideCardSkeleton key={`skel-${i}`} />
          ))}
        </div>

        <footer className="border-t border-slate-200 px-6 py-3 text-xs text-slate-500">
          {error ? (
            <span className="text-rose-600">{error}</span>
          ) : (
            <span>
              {slides.length} / {target} · Slides are saved as they appear — you can
              edit while we generate.
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
