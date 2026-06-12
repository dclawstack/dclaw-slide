"use client";

import { useState } from "react";
import Link from "next/link";
import type { Slide } from "@/lib/deck/types";
import { SlideView } from "./slide-view";

type Phase = "idle" | "working" | "done" | "error";

export function GenerateBox() {
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  async function generate() {
    if (prompt.trim().length < 3 || phase === "working") return;
    setPhase("working");
    setSlides([]);
    setDeckId(null);
    setTitle("");
    setStatus("Starting…");

    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok || !res.body) {
        throw new Error((await res.text()) || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          const event = JSON.parse(line.slice(5).trim());
          switch (event.type) {
            case "created":
              setDeckId(event.deckId);
              break;
            case "status":
              setStatus(event.message);
              break;
            case "outline":
              setTitle(event.outline.title);
              setStatus(`Outline agreed: ${event.outline.slides.length} slides`);
              break;
            case "slide":
              setSlides((prev) => [...prev, event.slide]);
              break;
            case "done":
              setTitle(event.deck.title);
              setPhase("done");
              setStatus("Deck ready");
              break;
            case "error":
              setPhase("error");
              setStatus(event.message);
              break;
          }
        }
      }
      setPhase((p) => (p === "working" ? "done" : p));
    } catch (err) {
      setPhase("error");
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="w-full max-w-3xl flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
          }}
          placeholder="Describe your deck — e.g. “Q3 business review for our biggest retail customer, focused on adoption wins and the renewal ask”"
          rows={3}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-pink-500 focus:outline-none resize-none"
        />
        <button
          onClick={generate}
          disabled={phase === "working" || prompt.trim().length < 3}
          className="self-end rounded-xl bg-pink-600 px-6 py-2.5 font-semibold text-white hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {phase === "working" ? "Generating…" : "Generate deck"}
        </button>
      </div>

      {phase !== "idle" && (
        <div
          className={`text-sm ${phase === "error" ? "text-red-400" : "text-zinc-400"}`}
        >
          {phase === "working" && <span className="animate-pulse">● </span>}
          {status}
        </div>
      )}

      {title && <h2 className="text-xl font-semibold">{title}</h2>}

      {slides.length > 0 && (
        <div className="flex flex-col gap-6">
          {slides.map((slide) => (
            <SlideView key={slide.id} slide={slide} />
          ))}
        </div>
      )}

      {phase === "done" && deckId && (
        <Link
          href={`/deck/${deckId}`}
          className="text-pink-400 hover:text-pink-300 text-sm font-medium"
        >
          Permalink → /deck/{deckId.slice(0, 8)}…
        </Link>
      )}
    </div>
  );
}
