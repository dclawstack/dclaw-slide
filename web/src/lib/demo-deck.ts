import type { DeckJson } from "@/lib/deck/types";

/**
 * Canned deck streamed when OPENROUTER_API_KEY is absent, so the app is
 * demoable end-to-end (UI, streaming, persistence) before keys are wired.
 */
export const DEMO_DECK: DeckJson = {
  version: 1,
  title: "DClaw Slide — Demo Deck",
  theme: { accent: "#EC4899", background: "dark", font: "sans" },
  slides: [
    {
      id: "s1",
      layout: "title",
      blocks: [
        { type: "heading", text: "Decks that look like your decks" },
        {
          type: "subheading",
          text: "AI generation locked to your brand — demo mode",
        },
      ],
      speakerNotes:
        "This is a demo deck. Add an OpenRouter key to generate real ones.",
    },
    {
      id: "s2",
      layout: "content",
      blocks: [
        { type: "heading", text: "The problem" },
        {
          type: "bullets",
          items: [
            "AI decks look like AI decks",
            "Brand drift creeps into every deck",
            "Reusable slides get rebuilt from scratch",
          ],
        },
      ],
      speakerNotes: "Three pains we measure, not one fuzzy one.",
    },
    {
      id: "s3",
      layout: "stats",
      blocks: [
        { type: "heading", text: "Why it matters" },
        { type: "stat", value: "6 hrs", label: "avg. time per branded deck" },
        { type: "stat", value: "20+", label: "decks a GTM team ships monthly" },
        { type: "stat", value: "1", label: "brand your decks should have" },
      ],
      speakerNotes: "The wedge: weekly branded decks for GTM teams.",
    },
    {
      id: "s4",
      layout: "closing",
      blocks: [
        { type: "heading", text: "Add your keys to go live" },
        {
          type: "paragraph",
          text: "Fill BUILD-INPUTS.md and the consensus pipeline takes over.",
        },
      ],
      speakerNotes: "End of demo.",
    },
  ],
};
