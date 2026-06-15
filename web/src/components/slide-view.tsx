import type { Slide, SlideBlock } from "@/lib/deck/types";

function Block({ block }: { block: SlideBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h2 className="text-3xl font-bold tracking-tight text-balance">
          {block.text}
        </h2>
      );
    case "subheading":
      return <p className="text-lg text-zinc-400">{block.text}</p>;
    case "paragraph":
      return <p className="text-base text-zinc-300 max-w-prose">{block.text}</p>;
    case "bullets":
      return (
        <ul className="space-y-2 text-left">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-zinc-200">
              <span className="text-pink-500 shrink-0">▸</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "stat":
      return (
        <div className="rounded-xl bg-zinc-800/60 px-5 py-4 text-center">
          <div className="text-3xl font-bold text-pink-400">{block.value}</div>
          <div className="text-sm text-zinc-400 mt-1">{block.label}</div>
        </div>
      );
    case "quote":
      return (
        <blockquote className="text-xl italic text-zinc-200 max-w-prose">
          “{block.text}”
          {block.attribution && (
            <footer className="text-sm text-zinc-500 mt-2 not-italic">
              — {block.attribution}
            </footer>
          )}
        </blockquote>
      );
    case "image": {
      // The designer emits an image *prompt*, not a URL. Synthesize a real
      // picture from it (Pollinations: free, keyless, generated from text).
      const src = block.url ?? imageUrl(block.prompt || block.alt);
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={block.alt}
          loading="lazy"
          className="rounded-lg w-full max-h-56 object-cover bg-zinc-800"
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

/** Real keyword-matched stock photo from a text prompt (no API key required). */
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

export function SlideView({ slide }: { slide: Slide }) {
  const stats = slide.blocks.filter((b) => b.type === "stat");
  const rest = slide.blocks.filter((b) => b.type !== "stat");
  const centered =
    slide.layout === "title" ||
    slide.layout === "section" ||
    slide.layout === "quote" ||
    slide.layout === "closing";

  return (
    <div
      className={`aspect-video w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-10 flex flex-col gap-5 overflow-hidden ${
        centered ? "items-center justify-center text-center" : "justify-center"
      }`}
    >
      {rest.map((block, i) => (
        <Block key={i} block={block} />
      ))}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-2">
          {stats.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}
