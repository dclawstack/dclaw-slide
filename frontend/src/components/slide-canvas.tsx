"use client";

import type { CSSProperties } from "react";
import { Quote } from "lucide-react";

import type { BrandKit, Slide, Theme } from "@/lib/api";

export interface SlideCanvasProps {
  slide: Slide;
  index: number;
  total: number;
  theme?: Theme | null;
  brandKit?: BrandKit | null;
  /**
   * "full" — designed for /present and /s/[token]: a 16:9 surface that
   *           fills its container with large type and full chrome.
   * "thumb" — a fixed 16:9 mini-canvas (default 320×180) you can drop next
   *           to an editor row. Same rendering, scaled down via CSS.
   */
  variant?: "full" | "thumb";
  /** Optional className applied to the root surface (use for width/height). */
  className?: string;
}

/**
 * One slide rendered with theme + brand kit baked in. The same component
 * powers the editor preview, the presenter view, and the public share view —
 * what you see while editing is exactly what gets shown.
 */
export function SlideCanvas({
  slide,
  index,
  total,
  theme,
  brandKit,
  variant = "full",
  className,
}: SlideCanvasProps) {
  const accent = brandKit?.accent_color || theme?.accent || "#EC4899";
  const background = theme?.background ?? "#FFFFFF";
  const isDark = isDarkColor(background);
  const textColor = isDark ? "#F8FAFC" : "#0F172A";
  const subTextColor = isDark ? "#94A3B8" : "#475569";
  const fontHeading = brandKit?.font_heading || theme?.font_heading || "Inter, system-ui, sans-serif";
  const fontBody = brandKit?.font_body || theme?.font_body || "Inter, system-ui, sans-serif";

  const bullets = slide.body
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => (line.startsWith("- ") || line.startsWith("* ") ? line.slice(2) : line));

  const surfaceStyle: CSSProperties = {
    backgroundColor: background,
    color: textColor,
    fontFamily: fontBody,
    // Subtle accent gradient overlay so solid-colour slides don't feel flat.
    backgroundImage: `radial-gradient(circle at 0% 0%, ${withAlpha(accent, isDark ? 0.18 : 0.08)}, transparent 45%)`,
  };

  return (
    <div
      data-variant={variant}
      className={`group relative overflow-hidden ${
        variant === "full" ? "aspect-[16/9] w-full" : "aspect-[16/9] w-full shadow-sm"
      } rounded-2xl border ${className ?? ""}`}
      style={{
        ...surfaceStyle,
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
      }}
    >
      {/* Logo (brand kit) — top right */}
      {brandKit?.logo_url && (
        <img
          src={brandKit.logo_url}
          alt=""
          className={`absolute right-4 top-4 ${
            variant === "full" ? "h-8" : "h-3"
          } w-auto opacity-70`}
        />
      )}

      {/* Slide body — layout-aware */}
      <div
        className={`flex h-full w-full flex-col justify-center ${
          variant === "full" ? "px-16 py-12" : "px-4 py-3"
        }`}
        style={{ fontFamily: fontBody }}
      >
        <LayoutBody
          slide={slide}
          bullets={bullets}
          accent={accent}
          textColor={textColor}
          subTextColor={subTextColor}
          fontHeading={fontHeading}
          variant={variant}
        />
      </div>

      {/* Footer chrome: accent bar + slide number */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: variant === "full" ? 6 : 3, backgroundColor: accent }}
      />
      <div
        className={`absolute bottom-3 left-4 font-mono ${
          variant === "full" ? "text-xs" : "text-[8px]"
        }`}
        style={{ color: subTextColor, opacity: 0.7 }}
      >
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>
      <div
        className={`absolute bottom-3 right-4 font-mono uppercase ${
          variant === "full" ? "text-[10px]" : "text-[7px]"
        }`}
        style={{ color: subTextColor, opacity: 0.5, letterSpacing: "0.12em" }}
      >
        {slide.layout}
      </div>
    </div>
  );
}

// ── Layout-aware body ─────────────────────────────────────────────────────────

interface LayoutBodyProps {
  slide: Slide;
  bullets: string[];
  accent: string;
  textColor: string;
  subTextColor: string;
  fontHeading: string;
  variant: "full" | "thumb";
}

function LayoutBody({
  slide,
  bullets,
  accent,
  textColor,
  subTextColor,
  fontHeading,
  variant,
}: LayoutBodyProps) {
  const sz = (full: string, thumb: string) => (variant === "full" ? full : thumb);

  if (slide.layout === "section-header") {
    return (
      <div
        className={`-mx-${variant === "full" ? 16 : 4} -my-${variant === "full" ? 12 : 3} flex h-[calc(100%+${
          variant === "full" ? 96 : 24
        }px)] items-center justify-center text-center`}
        style={{ backgroundColor: accent, color: pickContrast(accent) }}
      >
        <h1
          className={`font-bold ${sz("text-7xl", "text-lg")}`}
          style={{ fontFamily: fontHeading, letterSpacing: "-0.02em" }}
        >
          {slide.title || "Untitled"}
        </h1>
      </div>
    );
  }

  if (slide.layout === "title-only") {
    return (
      <div className="text-center">
        <h1
          className={`font-bold ${sz("text-7xl leading-[1.05]", "text-xl leading-tight")}`}
          style={{ fontFamily: fontHeading, color: accent, letterSpacing: "-0.02em" }}
        >
          {slide.title || "Untitled"}
        </h1>
        {bullets.length > 0 && (
          <p
            className={`mt-6 ${sz("text-2xl", "text-[8px]")}`}
            style={{ color: subTextColor }}
          >
            {bullets.join(" · ")}
          </p>
        )}
      </div>
    );
  }

  if (slide.layout === "quote") {
    return (
      <blockquote className="text-center">
        <Quote
          className={`mx-auto ${sz("h-12 w-12", "h-3 w-3")}`}
          style={{ color: accent, opacity: 0.5 }}
        />
        <p
          className={`mt-4 font-light italic ${sz("text-5xl leading-snug", "text-sm leading-snug")}`}
          style={{ color: textColor, fontFamily: fontHeading }}
        >
          {slide.body || "—"}
        </p>
        {slide.title && (
          <footer
            className={`mt-4 ${sz("text-lg", "text-[8px]")}`}
            style={{ color: subTextColor }}
          >
            — {slide.title}
          </footer>
        )}
      </blockquote>
    );
  }

  if (slide.layout === "two-column") {
    return (
      <div>
        <h1
          className={`mb-6 font-bold ${sz("text-5xl", "text-base")}`}
          style={{ fontFamily: fontHeading, color: accent, letterSpacing: "-0.02em" }}
        >
          {slide.title || "Untitled"}
        </h1>
        <div className={`grid grid-cols-2 ${sz("gap-8", "gap-2")}`}>
          {(bullets.length > 0 ? bullets.slice(0, 4) : ["", ""]).map((b, i) => (
            <div
              key={i}
              className={`rounded-xl border ${sz("p-6 text-2xl", "p-1 text-[8px]")}`}
              style={{
                borderColor: withAlpha(accent, 0.25),
                color: textColor,
                backgroundColor: withAlpha(accent, 0.04),
              }}
            >
              {b || "·"}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: title-bullets
  return (
    <div>
      <h1
        className={`mb-6 font-bold ${sz("text-5xl leading-tight", "text-base leading-tight")}`}
        style={{ fontFamily: fontHeading, color: accent, letterSpacing: "-0.02em" }}
      >
        {slide.title || "Untitled"}
      </h1>
      {bullets.length > 0 ? (
        <ul className={`space-y-${variant === "full" ? 3 : 1}`} style={{ color: textColor }}>
          {bullets.map((b, i) => (
            <li
              key={i}
              className={`flex gap-3 ${sz("text-2xl leading-snug", "text-[9px] leading-tight")}`}
            >
              <span style={{ color: accent }}>•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p
          className={`${sz("text-xl", "text-[8px]")}`}
          style={{ color: subTextColor, fontStyle: "italic" }}
        >
          No content yet
        </p>
      )}
    </div>
  );
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.replace("#", "");
  if (cleaned.length === 3) {
    return [
      parseInt(cleaned[0] + cleaned[0], 16),
      parseInt(cleaned[1] + cleaned[1], 16),
      parseInt(cleaned[2] + cleaned[2], 16),
    ];
  }
  if (cleaned.length === 6) {
    return [
      parseInt(cleaned.slice(0, 2), 16),
      parseInt(cleaned.slice(2, 4), 16),
      parseInt(cleaned.slice(4, 6), 16),
    ];
  }
  return null;
}

function isDarkColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  // Standard relative luminance threshold.
  const [r, g, b] = rgb;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.55;
}

function pickContrast(hex: string): string {
  return isDarkColor(hex) ? "#F8FAFC" : "#0F172A";
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}
