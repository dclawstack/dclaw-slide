import type { DeckJson } from "./types";

export interface ResolvedTheme {
  id: string;
  name: string;
  description: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  fontBody: string;
  fontHeading: string;
  isDark: boolean;
  emoji: string;
}

const SERIF = '"Source Serif 4", Georgia, serif';
const SANS = 'Inter, system-ui, -apple-system, sans-serif';

export const THEMES: ResolvedTheme[] = [
  {
    id: "slide-dark",
    name: "Slide — Dark",
    description: "The DClaw default. White on near-black, pink accent.",
    accent: "#EC4899",
    bg: "#18181b",
    surface: "rgba(39,39,42,0.6)",
    text: "#f4f4f5",
    muted: "#a1a1aa",
    border: "#27272a",
    fontBody: SANS,
    fontHeading: SANS,
    isDark: true,
    emoji: "💗",
  },
  {
    id: "pitch-classic",
    name: "Pitch — Classic",
    description: "Investor-friendly. Serif headings, lots of whitespace.",
    accent: "#EC4899",
    bg: "#ffffff",
    surface: "#f4f4f5",
    text: "#18181b",
    muted: "#52525b",
    border: "#e4e4e7",
    fontBody: SANS,
    fontHeading: SERIF,
    isDark: false,
    emoji: "🚀",
  },
  {
    id: "pitch-bold",
    name: "Pitch — Bold",
    description: "High-contrast, oversized headlines for Series A.",
    accent: "#FACC15",
    bg: "#0f172a",
    surface: "rgba(30,41,59,0.7)",
    text: "#f8fafc",
    muted: "#94a3b8",
    border: "#1e293b",
    fontBody: SANS,
    fontHeading: SANS,
    isDark: true,
    emoji: "⚡",
  },
  {
    id: "report-minimal",
    name: "Report — Minimal",
    description: "Quiet, data-dense layout for quarterly reports.",
    accent: "#0EA5E9",
    bg: "#f8fafc",
    surface: "#eef2f6",
    text: "#0f172a",
    muted: "#475569",
    border: "#e2e8f0",
    fontBody: SANS,
    fontHeading: SANS,
    isDark: false,
    emoji: "📊",
  },
  {
    id: "training-warm",
    name: "Training — Warm",
    description: "Friendly tone, large body text for onboarding.",
    accent: "#F97316",
    bg: "#fff7ed",
    surface: "#ffedd5",
    text: "#431407",
    muted: "#9a3412",
    border: "#fed7aa",
    fontBody: SANS,
    fontHeading: SANS,
    isDark: false,
    emoji: "🎓",
  },
  {
    id: "dark-investor",
    name: "Dark — Investor",
    description: "Late-night demo aesthetic. Violet on black.",
    accent: "#A78BFA",
    bg: "#0b0b12",
    surface: "rgba(30,27,46,0.7)",
    text: "#ede9fe",
    muted: "#a5a3c0",
    border: "#241f33",
    fontBody: SANS,
    fontHeading: SANS,
    isDark: true,
    emoji: "🌙",
  },
];

export const DEFAULT_THEME = THEMES[0];

/** Resolve a deck's stored theme to concrete styling. */
export function resolveTheme(theme: DeckJson["theme"] | undefined): ResolvedTheme {
  if (theme?.id) {
    const found = THEMES.find((t) => t.id === theme.id);
    if (found) return found;
  }
  // Back-compat for decks stored before named themes: derive from accent/bg.
  if (theme) {
    const dark = theme.background !== "light";
    const base = dark ? THEMES[0] : THEMES[1];
    return {
      ...base,
      id: "custom",
      name: "Custom",
      accent: theme.accent ?? base.accent,
      fontHeading: theme.font === "serif" ? SERIF : base.fontHeading,
    };
  }
  return DEFAULT_THEME;
}
