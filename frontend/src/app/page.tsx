import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  Download,
  Gauge,
  Github,
  Layers,
  Palette,
  Play,
  Presentation as PresentationIcon,
  Share2,
  Sparkles,
  Users,
  Wand2,
  Zap,
} from "lucide-react";

import { SlideCanvas } from "@/components/slide-canvas";
// Demo seed/clear controls — remove this import + the <DemoDataControls /> usage
// below, plus src/components/demo-data-controls.tsx, to delete the feature.
import { DemoDataControls } from "@/components/demo-data-controls";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <TopNav />
      <Hero />
      <DemoDataControls />
      <TrustBand />
      <WedgeSection />
      <FeatureGrid />
      <HowItWorks />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Top nav — sticky, minimal
// ──────────────────────────────────────────────────────────────────────────────

function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-500 text-white">
            <PresentationIcon className="h-4 w-4" />
          </span>
          <span className="font-semibold tracking-tight">DClaw Slide</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-slate-600 sm:flex">
          <a href="#wedges" className="hover:text-slate-900">Why us</a>
          <a href="#features" className="hover:text-slate-900">Features</a>
          <a href="#how" className="hover:text-slate-900">How it works</a>
          <Link href="/brand" className="hover:text-slate-900">Brand kit</Link>
        </nav>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Open the app
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Hero — headline + sub + CTAs + live slide preview
// ──────────────────────────────────────────────────────────────────────────────

function Hero() {
  // Mock slide we use to render a real SlideCanvas in the hero (this is the
  // exact same component that renders inside the editor — wysiwyg from page 1).
  const mockSlide = {
    id: "demo",
    presentation_id: "demo",
    position: 0,
    layout: "title-bullets",
    title: "Why this deck looks like ours",
    body:
      "- Brand colors pulled from your saved brand kit, not a theme preset.\n" +
      "- Voice retrieved from your past decks using a small TF-IDF index.\n" +
      "- AI critic re-picks the layout when the LLM gets it wrong.\n" +
      "- Generated in under 30 seconds and editable in place.",
    speaker_notes: "",
    created_at: "",
    updated_at: "",
  };
  const mockTheme = {
    id: "pitch-classic",
    name: "Pitch Classic",
    description: "",
    accent: "#EC4899",
    background: "#FFFFFF",
    font_heading: "Inter, system-ui, sans-serif",
    font_body: "Inter, system-ui, sans-serif",
    cover_emoji: "🚀",
  };

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(236,72,153,0.10) 0%, rgba(255,255,255,0) 60%)," +
            "radial-gradient(50% 30% at 100% 30%, rgba(251,191,36,0.10) 0%, rgba(255,255,255,0) 60%)",
        }}
      />
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-28">
        <div className="animate-slide-in-bottom">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
            <Sparkles className="h-3.5 w-3.5" />
            AI presentations that stay on-brand
          </div>

          <h1 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl">
            Decks that look like{" "}
            <span className="text-rose-500">yours</span>.<br />
            Generated in seconds.
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            Type a topic. Get a real presentation conditioned on your brand kit
            and past decks — editable, exportable, and shareable behind a
            password. No more brand drift, no more starting from a blank slide.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600"
            >
              Try the AI Copilot
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              See how it works
            </a>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-slate-200 pt-6 text-sm">
            <Stat value="~20s" label="To generate" />
            <Stat value="3" label="Export formats" />
            <Stat value="5" label="Smart layouts" />
          </dl>
        </div>

        <div className="relative animate-fade-scale-in">
          {/* Faux browser chrome wrapping a real SlideCanvas */}
          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
            <div className="flex items-center gap-1.5 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              <span className="ml-3 truncate font-mono text-[10px] text-slate-400">
                dclaw-slide.app / p / a1b2c3
              </span>
            </div>
            <div className="overflow-hidden rounded-xl">
              <SlideCanvas
                slide={mockSlide}
                index={2}
                total={8}
                theme={mockTheme}
                variant="full"
              />
            </div>
          </div>

          {/* Floating accent pill */}
          <div className="absolute -bottom-4 -left-4 hidden rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg sm:flex sm:items-center sm:gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Built with 1 brand reference
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="text-2xl font-bold tracking-tight text-slate-900">{value}</dt>
      <dd className="mt-0.5 text-xs uppercase tracking-wide text-slate-500">{label}</dd>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Trust band — who it's for
// ──────────────────────────────────────────────────────────────────────────────

function TrustBand() {
  return (
    <section className="border-y border-slate-100 bg-slate-50/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-6 text-sm text-slate-500">
        <span className="font-medium uppercase tracking-wider text-slate-400">
          Built for
        </span>
        <span>GTM teams shipping a deck a week</span>
        <span className="hidden sm:inline">·</span>
        <span>Founders rehearsing pitches</span>
        <span className="hidden sm:inline">·</span>
        <span>Consultants who can&apos;t look off-brand</span>
        <span className="hidden sm:inline">·</span>
        <span>Customer success leads</span>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Wedge section — the three things only DClaw Slide does
// ──────────────────────────────────────────────────────────────────────────────

function WedgeSection() {
  return (
    <section id="wedges" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">
            What makes us different
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Three things no other AI deck tool does
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Gamma, Tome, and Pitch generate every deck from generic training
            data. We retrieve <em>your</em> content, run the LLM through a
            critic, and track how your audience actually responds.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <Wedge
            icon={<BookOpen className="h-5 w-5" />}
            title="Brand RAG"
            sub="Decks inherit your voice"
            body="Paste past decks, docs, or website copy as references. Every new generation retrieves the top matches and conditions the LLM on them — your phrasing, your vocabulary, your sentence rhythm."
          />
          <Wedge
            icon={<Wand2 className="h-5 w-5" />}
            title="AI critic layout"
            sub="Slides that look designed"
            body="A heuristic layout picker reviews every slide the LLM produces and overrides bad picks. One short bullet becomes a hero. Two short bullets become a two-column. Section-headers get full-bleed accent."
          />
          <Wedge
            icon={<BarChart3 className="h-5 w-5" />}
            title="Audience analytics"
            sub="Know which slide lost the room"
            body="Every share-link view records per-slide dwell time, advances, and dropoffs. The detail page shows a heatmap so you can see exactly where the room tuned out — and fix that slide."
          />
        </div>
      </div>
    </section>
  );
}

function Wedge({
  icon,
  title,
  sub,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  body: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-7 transition hover:border-rose-200 hover:shadow-lg">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600 group-hover:bg-rose-100">
        {icon}
      </div>
      <h3 className="mt-5 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="text-sm font-medium text-rose-600">{sub}</p>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Feature grid — the full surface area
// ──────────────────────────────────────────────────────────────────────────────

function FeatureGrid() {
  const features = [
    {
      icon: <Sparkles className="h-5 w-5" />,
      title: "AI Slide Copilot",
      body:
        "Type a prompt, pick deck type and length, watch slides stream in one-by-one. Auto-falls back to a deterministic template if your local LLM is offline — never throws.",
    },
    {
      icon: <Palette className="h-5 w-5" />,
      title: "Brand kit",
      body:
        "Lock colors, fonts, logo, and voice once per workspace. Cascades as CSS variables across every deck, presenter view, and shared link. Brand drift, gone.",
    },
    {
      icon: <Layers className="h-5 w-5" />,
      title: "5 smart layouts",
      body:
        "Title-only, title-bullets, section-header, quote, two-column. A rule-based picker chooses the best one per slide and an Auto-layout button re-runs it on demand.",
    },
    {
      icon: <Download className="h-5 w-5" />,
      title: "Export anywhere",
      body:
        "PDF (reportlab), PPTX (python-pptx), HTML zip — all pure-Python, all one click. Speaker notes included in every format.",
    },
    {
      icon: <Play className="h-5 w-5" />,
      title: "Presenter view",
      body:
        "Full-screen slideshow with theme background, accent gradient, slide-number badge, and your logo in the corner. Arrow-key nav. Records dwell on every slide.",
    },
    {
      icon: <Share2 className="h-5 w-5" />,
      title: "Share with password",
      body:
        "Tokenized public links with optional password and expiry. Audience views feed into the same analytics heatmap. Rotate or revoke any time.",
    },
    {
      icon: <Users className="h-5 w-5" />,
      title: "Live presence",
      body:
        "Open the same deck in two tabs and see who else is editing in real time. Every save broadcasts via WebSocket so the other view auto-refetches.",
    },
    {
      icon: <Gauge className="h-5 w-5" />,
      title: "Streaming generation",
      body:
        "Slides arrive over Server-Sent Events as the LLM produces them — saved to the DB as they land, so refreshing mid-stream shows what already arrived.",
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: "Speaker notes & Q&A",
      body:
        "One click per slide generates 2-4 sentences of presenter notes plus 3-5 questions an audience is likely to ask. Persisted on the slide.",
    },
  ];

  return (
    <section id="features" className="bg-slate-50/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">
            Features
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Everything you need to ship a deck
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Built end-to-end, not glued together. FastAPI + Next.js, SQLAlchemy
            2.0, Ollama or OpenRouter for the LLM, pure-Python TF-IDF for
            retrieval. No vendor lock-in.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
                {f.icon}
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// How it works — three steps
// ──────────────────────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Set up your brand kit",
      body:
        "Pick your accent color, fonts, and (optionally) paste excerpts from past decks as brand references. One workspace, one brand kit — every deck inherits it.",
      cta: { href: "/brand", label: "Open brand kit" },
    },
    {
      n: "02",
      title: "Type a prompt, watch the deck appear",
      body:
        "Describe your topic, choose deck length and type, hit Generate. Slides stream in one-by-one — already brand-locked, already laid out. Edit any slide in the drawer.",
      cta: { href: "/dashboard", label: "Try the Copilot" },
    },
    {
      n: "03",
      title: "Present, share, export",
      body:
        "Full-screen presenter view with dwell tracking. Share a password-protected link with anyone. Export to PDF, PPTX, or HTML — speaker notes included.",
      cta: { href: "/dashboard", label: "See it live" },
    },
  ];

  return (
    <section id="how" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">
            How it works
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Three steps. About ninety seconds.
          </h2>
        </div>

        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="relative">
              <span className="font-mono text-sm font-semibold text-rose-500">
                {s.n}
              </span>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">
                {s.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {s.body}
              </p>
              <Link
                href={s.cta.href}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-rose-600 hover:text-rose-700"
              >
                {s.cta.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Final CTA
// ──────────────────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-slate-900 py-20 text-white sm:py-28">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 100%, rgba(236,72,153,0.18) 0%, rgba(15,23,42,0) 60%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Stop starting from a blank slide.
        </h2>
        <p className="mt-5 text-lg text-slate-300">
          Open the app, generate your first deck, and see it presented in your
          brand colors. Takes less than two minutes.
        </p>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
          {[
            "No signup",
            "Local-first",
            "Works offline (template fallback)",
            "Export to PDF/PPTX/HTML",
          ].map((line) => (
            <li key={line} className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-400" />
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-10 flex justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Open the dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Footer
// ──────────────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-rose-500 text-white">
            <PresentationIcon className="h-3.5 w-3.5" />
          </span>
          <span className="font-medium text-slate-700">DClaw Slide</span>
          <span className="text-slate-400">·</span>
          <span>v1.0</span>
        </div>
        <nav className="flex items-center gap-5">
          <Link href="/dashboard" className="hover:text-slate-900">Dashboard</Link>
          <Link href="/brand" className="hover:text-slate-900">Brand kit</Link>
          <a
            href="https://github.com/dclawstack/dclaw-slide"
            className="inline-flex items-center gap-1.5 hover:text-slate-900"
          >
            <Github className="h-3.5 w-3.5" /> Source
          </a>
        </nav>
        <span className="text-xs text-slate-400">
          Built by{" "}
          <a
            href="mailto:tharunidayara@gmail.com"
            className="underline-offset-2 hover:underline"
          >
            Tharuni Dayara
          </a>
        </span>
      </div>
    </footer>
  );
}
