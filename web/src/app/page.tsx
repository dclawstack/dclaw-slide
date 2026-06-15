import Link from "next/link";
import { SlideView } from "@/components/slide-view";
import { DemoDataControls } from "@/components/demo-data-controls";
import type { Slide, DeckJson } from "@/lib/deck/types";

const HERO_SLIDE: Slide = {
  id: "hero",
  layout: "stats",
  blocks: [
    { type: "heading", text: "Why this deck looks like ours" },
    { type: "subheading", text: "Brand-locked. Data-fresh. Demo-ready." },
    {
      type: "bullets",
      items: [
        "Voice retrieved from your past decks",
        "A consensus of models drafts → judges → designs",
        "Context-relevant images generated per slide",
      ],
    },
    { type: "stat", value: "~60s", label: "to a full deck" },
    { type: "stat", value: "6", label: "themes" },
    { type: "stat", value: "1", label: "brand — yours" },
  ],
  speakerNotes: "",
};
const HERO_THEME: DeckJson["theme"] = {
  id: "dark-investor",
  accent: "#A78BFA",
  background: "dark",
  font: "sans",
};

const DIVE_BRAND: Slide = {
  id: "dive-brand",
  layout: "content",
  blocks: [
    { type: "heading", text: "On-brand, automatically" },
    {
      type: "bullets",
      items: [
        "Voice pulled from your past decks",
        "Your numbers, your phrasing",
        "Consistent across every deck",
      ],
    },
  ],
  speakerNotes: "",
};
const DIVE_PRESENT: Slide = {
  id: "dive-present",
  layout: "stats",
  blocks: [
    { type: "heading", text: "Present from the browser" },
    { type: "stat", value: "←/→", label: "arrow nav" },
    { type: "stat", value: "n", label: "notes panel" },
    { type: "stat", value: "Esc", label: "exit" },
  ],
  speakerNotes: "",
};

const DEEP_DIVES: {
  tag: string;
  title: string;
  body: string;
  slide: Slide;
  theme: DeckJson["theme"];
  flip?: boolean;
}[] = [
  {
    tag: "Consensus generation",
    title: "Three models, one great deck",
    body: "Two models draft outlines independently, a judge merges the best of each, and a designer model writes the slides — streamed in live, slide by slide. More reliable and less generic than a single prompt.",
    slide: {
      id: "dive-gen",
      layout: "content",
      blocks: [
        { type: "heading", text: "Outline → Judge → Design" },
        { type: "bullets", items: ["Draft (×2 models)", "Merge the best", "Design + stream"] },
      ],
      speakerNotes: "",
    },
    theme: { id: "slide-dark", accent: "#EC4899", background: "dark", font: "sans" },
  },
  {
    tag: "Brand RAG",
    title: "Decks that sound like you",
    body: "Upload your past decks and notes to the brand library. Every new deck retrieves your voice, terminology and reusable content — so it reads like your team wrote it, not a chatbot.",
    slide: DIVE_BRAND,
    theme: { id: "pitch-classic", accent: "#EC4899", background: "light", font: "sans" },
    flip: true,
  },
  {
    tag: "Present & share",
    title: "From draft to delivery",
    body: "Switch themes in a click, edit any block inline, then present fullscreen or share a tokenized link with an optional password. Print-to-PDF for the inbox. Analytics on every view, present and share.",
    slide: DIVE_PRESENT,
    theme: { id: "pitch-bold", accent: "#FACC15", background: "dark", font: "sans" },
  },
];

const FEATURES = [
  ["🧠", "Consensus generation", "Two models draft outlines, a judge merges them, a designer writes the slides. Better than one-shot prompting."],
  ["🎨", "Brand-locked", "Upload past decks; new ones reuse your voice and content via retrieval — not a generic theme preset."],
  ["🖼", "Generated images", "A unique, context-relevant image per image-slide. No stock-photo sameness."],
  ["🎭", "6 themes", "Switch the whole deck's look — accent, background, fonts — in one click. Saved instantly."],
  ["▶", "Presenter mode", "Fullscreen, arrow-key nav, speaker-notes panel. Rehearse and present from the browser."],
  ["🔗", "Share & export", "Tokenized links with optional passwords, plus print-to-PDF. Analytics on every view."],
];

const STEPS = [
  ["Describe it", "Type the deck you need — audience, angle, the ask."],
  ["Watch it build", "Outline → judge → design streams in live, slide by slide."],
  ["Make it yours", "Switch theme, edit any block, present or share."],
];

export default function Landing() {
  return (
    <div className="flex flex-col flex-1">
      <header className="sticky top-0 z-30 border-b border-zinc-800/70 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-bold tracking-tight">
            <span className="text-pink-500">DClaw</span> Slide
          </span>
          <nav className="hidden sm:flex items-center gap-7 text-sm text-zinc-400">
            <a href="#features" className="hover:text-zinc-100">Features</a>
            <a href="#how" className="hover:text-zinc-100">How it works</a>
            <Link href="/brand" className="hover:text-zinc-100">Brand library</Link>
            <Link href="/dashboard" className="hover:text-zinc-100">Dashboard</Link>
          </nav>
          <Link
            href="/new"
            className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-500"
          >
            Generate a deck
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-xs font-medium text-pink-300">
            ✨ AI decks, locked to your brand
          </span>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-balance">
            Decks that look like <span className="text-pink-500">your</span>{" "}
            decks
          </h1>
          <p className="text-lg text-zinc-400 max-w-xl">
            Describe what you need. A consensus of models drafts, judges and
            designs it — in your brand voice, with generated images, ready to
            present or share in about a minute.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/new"
              className="rounded-xl bg-pink-600 px-6 py-3 font-semibold text-white hover:bg-pink-500"
            >
              Generate a deck →
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-zinc-700 px-6 py-3 font-semibold text-zinc-200 hover:border-zinc-500"
            >
              Open dashboard
            </Link>
          </div>
        </div>
        <div className="lg:scale-105">
          <SlideView slide={HERO_SLIDE} theme={HERO_THEME} />
        </div>
      </section>

      {/* Demo data controls (removable — see src/demo/seed.ts) */}
      <DemoDataControls />

      {/* Feature deep-dives */}
      <section className="mx-auto max-w-6xl px-6 py-12 flex flex-col gap-20">
        {DEEP_DIVES.map((d) => (
          <div
            key={d.tag}
            className={`grid gap-10 lg:grid-cols-2 lg:items-center ${
              d.flip ? "lg:[&>*:first-child]:order-2" : ""
            }`}
          >
            <div className="flex flex-col gap-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-pink-400">
                {d.tag}
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-balance">
                {d.title}
              </h2>
              <p className="text-zinc-400 max-w-lg">{d.body}</p>
            </div>
            <SlideView slide={d.slide} theme={d.theme} />
          </div>
        ))}
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-bold mb-10">Everything in one deploy</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([icon, title, body]) => (
            <div
              key={title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
            >
              <div className="text-2xl">{icon}</div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-bold mb-10">How it works</h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <div key={title} className="flex flex-col gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-pink-600 font-bold text-white">
                {i + 1}
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-pink-600/15 to-violet-600/10 p-12 text-center">
          <h2 className="text-3xl font-bold text-balance">
            Your next deck, in about a minute
          </h2>
          <p className="mt-3 text-zinc-400">
            No setup. Describe it and watch it build.
          </p>
          <Link
            href="/new"
            className="mt-6 inline-block rounded-xl bg-pink-600 px-8 py-3 font-semibold text-white hover:bg-pink-500"
          >
            Generate a deck →
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-800 py-8 text-center text-sm text-zinc-600">
        DClaw Slide · built on Next.js, Neon & OpenRouter
      </footer>
    </div>
  );
}
