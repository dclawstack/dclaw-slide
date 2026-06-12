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
    case "image":
      return block.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.url}
          alt={block.alt}
          className="rounded-lg max-h-48 object-cover"
        />
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-700 px-4 py-6 text-sm text-zinc-500">
          🖼 {block.alt}
        </div>
      );
  }
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
