import type { Slide, SlideBlock, DeckJson } from "@/lib/deck/types";
import { resolveTheme, type ResolvedTheme } from "@/lib/deck/themes";

function Block({ block, t }: { block: SlideBlock; t: ResolvedTheme }) {
  switch (block.type) {
    case "heading":
      return (
        <h2
          className="text-3xl font-bold tracking-tight text-balance"
          style={{ fontFamily: t.fontHeading }}
        >
          {block.text}
        </h2>
      );
    case "subheading":
      return (
        <p className="text-lg" style={{ color: t.muted }}>
          {block.text}
        </p>
      );
    case "paragraph":
      return (
        <p className="text-base max-w-prose" style={{ color: t.text }}>
          {block.text}
        </p>
      );
    case "bullets":
      return (
        <ul className="space-y-2 text-left">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3" style={{ color: t.text }}>
              <span className="shrink-0" style={{ color: t.accent }}>
                ▸
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "stat":
      return (
        <div
          className="rounded-xl px-5 py-4 text-center"
          style={{ backgroundColor: t.surface }}
        >
          <div className="text-3xl font-bold" style={{ color: t.accent }}>
            {block.value}
          </div>
          <div className="text-sm mt-1" style={{ color: t.muted }}>
            {block.label}
          </div>
        </div>
      );
    case "quote":
      return (
        <blockquote
          className="text-xl italic max-w-prose"
          style={{ color: t.text }}
        >
          “{block.text}”
          {block.attribution && (
            <footer
              className="text-sm mt-2 not-italic"
              style={{ color: t.muted }}
            >
              — {block.attribution}
            </footer>
          )}
        </blockquote>
      );
    case "image": {
      const src = block.url ?? imageUrl(block.prompt || block.alt);
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={block.alt}
          loading="lazy"
          className="rounded-lg w-full max-h-56 object-cover"
          style={{ backgroundColor: t.surface }}
        />
      );
    }
  }
}

const STOPWORDS = new Set([
  "a","an","the","of","for","and","with","showing","image","photo","picture",
  "illustration","depicting","that","this","our","your","their","in","on","to",
  "background","hero","slide","visual","graphic","concept","abstract",
]);

/** Keyword-matched stock photo fallback for decks without AI images. */
function imageUrl(prompt: string): string {
  const keywords = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 3)
    .join(",");
  const lock = hashSeed(prompt);
  return `https://loremflickr.com/768/432/${keywords || "business"}?lock=${lock}`;
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 100000;
}

export function SlideView({
  slide,
  theme,
}: {
  slide: Slide;
  theme?: DeckJson["theme"];
}) {
  const t = resolveTheme(theme);
  const stats = slide.blocks.filter((b) => b.type === "stat");
  const rest = slide.blocks.filter((b) => b.type !== "stat");
  const centered =
    slide.layout === "title" ||
    slide.layout === "section" ||
    slide.layout === "quote" ||
    slide.layout === "closing";

  return (
    <div
      className={`aspect-video w-full rounded-2xl border p-10 flex flex-col gap-5 overflow-hidden ${
        centered ? "items-center justify-center text-center" : "justify-center"
      }`}
      style={{
        backgroundColor: t.bg,
        color: t.text,
        borderColor: t.border,
        fontFamily: t.fontBody,
      }}
    >
      {rest.map((block, i) => (
        <Block key={i} block={block} t={t} />
      ))}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-2">
          {stats.map((block, i) => (
            <Block key={i} block={block} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
