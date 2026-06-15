"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DeckJson } from "@/lib/deck/types";
import { SlideView } from "@/components/slide-view";

export default function PresentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [deck, setDeck] = useState<DeckJson | null>(null);
  const [missing, setMissing] = useState(false);
  const [i, setI] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    fetch(`/api/decks/${id}`).then(async (res) => {
      if (!res.ok) return setMissing(true);
      const row = await res.json();
      if (row?.deckJson) setDeck(row.deckJson);
      else setMissing(true);
    });
    fetch(`/api/decks/${id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "present" }),
    }).catch(() => {});
  }, [id]);

  const total = deck?.slides.length ?? 0;
  const next = useCallback(
    () => setI((v) => Math.min(v + 1, total - 1)),
    [total]
  );
  const prev = useCallback(() => setI((v) => Math.max(v - 1, 0)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "n") {
        setShowNotes((v) => !v);
      } else if (e.key === "Escape") {
        window.location.href = `/deck/${id}`;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, id]);

  if (missing) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-zinc-500">
        Deck not found.{" "}
        <Link href="/dashboard" className="text-pink-400 ml-2">
          Dashboard
        </Link>
      </div>
    );
  }
  if (!deck) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-zinc-500">
        Loading…
      </div>
    );
  }

  const slide = deck.slides[i];

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-5xl">
          <SlideView slide={slide} theme={deck.theme} />
        </div>
      </div>

      {showNotes && slide.speakerNotes && (
        <div className="mx-auto mb-2 max-w-5xl w-full px-6">
          <div className="rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-zinc-300">
            <span className="text-zinc-500">Notes: </span>
            {slide.speakerNotes}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-6 py-3 text-sm text-zinc-500">
        <Link href={`/deck/${id}`} className="hover:text-zinc-300">
          ✕ Exit
        </Link>
        <div className="flex items-center gap-4">
          <button onClick={prev} disabled={i === 0} className="disabled:opacity-30">
            ←
          </button>
          <span>
            {i + 1} / {total}
          </span>
          <button
            onClick={next}
            disabled={i === total - 1}
            className="disabled:opacity-30"
          >
            →
          </button>
        </div>
        <button
          onClick={() => setShowNotes((v) => !v)}
          className="hover:text-zinc-300"
        >
          {showNotes ? "Hide notes (n)" : "Notes (n)"}
        </button>
      </div>
    </div>
  );
}
