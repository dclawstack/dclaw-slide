"use client";

import { useState } from "react";
import Link from "next/link";
import type { DeckJson, Slide, SlideBlock } from "@/lib/deck/types";
import { THEMES } from "@/lib/deck/themes";
import { SlideView } from "./slide-view";
import { ShareButton } from "./share-button";

export function DeckWorkspace({
  deckId,
  initialDeck,
}: {
  deckId: string;
  initialDeck: DeckJson;
}) {
  const [deck, setDeck] = useState<DeckJson>(initialDeck);
  const [editing, setEditing] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function persist(next: DeckJson) {
    setSaving(true);
    try {
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckJson: next }),
      });
      if (res.ok) setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  }

  function applyTheme(id: string) {
    const t = THEMES.find((x) => x.id === id);
    if (!t) return;
    const next: DeckJson = {
      ...deck,
      theme: {
        id: t.id,
        accent: t.accent,
        background: t.isDark ? "dark" : "light",
        font: "sans",
      },
    };
    setDeck(next);
    persist(next);
  }

  function updateSlide(index: number, slide: Slide) {
    setDeck((d) => ({
      ...d,
      slides: d.slides.map((s, i) => (i === index ? slide : s)),
    }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select
          value={deck.theme?.id ?? "slide-dark"}
          onChange={(e) => applyTheme(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
          aria-label="Theme"
        >
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.emoji} {t.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowNotes((v) => !v)}
          className={`rounded-lg border px-3 py-2 ${
            showNotes
              ? "border-pink-500 text-pink-400"
              : "border-zinc-700 text-zinc-300"
          }`}
        >
          {showNotes ? "Hide notes" : "Speaker notes"}
        </button>

        <button
          onClick={() => {
            if (editing) persist(deck);
            setEditing((v) => !v);
          }}
          className={`rounded-lg border px-3 py-2 ${
            editing
              ? "border-emerald-500 text-emerald-400"
              : "border-zinc-700 text-zinc-300"
          }`}
        >
          {editing ? "Done editing" : "Edit"}
        </button>

        <Link
          href={`/deck/${deckId}/present`}
          className="rounded-lg bg-pink-600 px-3 py-2 font-medium text-white hover:bg-pink-500"
        >
          ▶ Present
        </Link>

        <ShareButton deckId={deckId} />

        <span className="text-zinc-500 ml-auto">
          {saving ? "Saving…" : savedAt ? `Saved ${savedAt}` : ""}
        </span>
      </div>

      <div className="flex flex-col gap-8">
        {deck.slides.map((slide, i) => (
          <div key={slide.id} className="flex flex-col gap-3">
            <div className="text-xs text-zinc-600">Slide {i + 1}</div>
            {editing ? (
              <SlideEditor
                slide={slide}
                onChange={(s) => updateSlide(i, s)}
              />
            ) : (
              <SlideView slide={slide} theme={deck.theme} />
            )}
            {showNotes && slide.speakerNotes && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400">
                <span className="text-zinc-500 font-medium">Notes: </span>
                {slide.speakerNotes}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideEditor({
  slide,
  onChange,
}: {
  slide: Slide;
  onChange: (s: Slide) => void;
}) {
  function setBlock(index: number, block: SlideBlock) {
    onChange({
      ...slide,
      blocks: slide.blocks.map((b, i) => (i === index ? block : b)),
    });
  }
  function setNotes(v: string) {
    onChange({ ...slide, speakerNotes: v });
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col gap-4">
      {slide.blocks.map((block, i) => (
        <BlockEditor key={i} block={block} onChange={(b) => setBlock(i, b)} />
      ))}
      <label className="text-xs text-zinc-500">
        Speaker notes
        <textarea
          value={slide.speakerNotes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
        />
      </label>
    </div>
  );
}

const field =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100";

function BlockEditor({
  block,
  onChange,
}: {
  block: SlideBlock;
  onChange: (b: SlideBlock) => void;
}) {
  switch (block.type) {
    case "heading":
    case "subheading":
    case "paragraph":
      return (
        <label className="text-xs text-zinc-500 capitalize">
          {block.type}
          <textarea
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            rows={block.type === "paragraph" ? 3 : 1}
            className={`mt-1 ${field}`}
          />
        </label>
      );
    case "bullets":
      return (
        <label className="text-xs text-zinc-500">
          Bullets (one per line)
          <textarea
            value={block.items.join("\n")}
            onChange={(e) =>
              onChange({
                ...block,
                items: e.target.value.split("\n").filter(Boolean),
              })
            }
            rows={Math.max(2, block.items.length)}
            className={`mt-1 ${field}`}
          />
        </label>
      );
    case "stat":
      return (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-zinc-500">
            Value
            <input
              value={block.value}
              onChange={(e) => onChange({ ...block, value: e.target.value })}
              className={`mt-1 ${field}`}
            />
          </label>
          <label className="text-xs text-zinc-500">
            Label
            <input
              value={block.label}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
              className={`mt-1 ${field}`}
            />
          </label>
        </div>
      );
    case "quote":
      return (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-zinc-500">
            Quote
            <textarea
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
              rows={2}
              className={`mt-1 ${field}`}
            />
          </label>
          <label className="text-xs text-zinc-500">
            Attribution
            <input
              value={block.attribution ?? ""}
              onChange={(e) =>
                onChange({ ...block, attribution: e.target.value })
              }
              className={`mt-1 ${field}`}
            />
          </label>
        </div>
      );
    case "image":
      return (
        <label className="text-xs text-zinc-500">
          Image caption
          <input
            value={block.alt}
            onChange={(e) => onChange({ ...block, alt: e.target.value })}
            className={`mt-1 ${field}`}
          />
        </label>
      );
  }
}
