import Link from "next/link";
import { GenerateBox } from "@/components/generate-box";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16 gap-10">
      <header className="w-full max-w-3xl flex items-center justify-between">
        <span className="font-bold tracking-tight">
          <span className="text-pink-500">DClaw</span> Slide
        </span>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/brand" className="text-zinc-400 hover:text-zinc-200">
            Brand library
          </Link>
          <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-200">
            Dashboard →
          </Link>
        </nav>
      </header>

      <main className="flex flex-col items-center gap-4 text-center max-w-3xl">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-balance">
          Decks that look like <span className="text-pink-500">your</span>{" "}
          decks
        </h1>
        <p className="text-lg text-zinc-400 max-w-xl">
          Describe the deck you need. A consensus of models drafts, judges and
          designs it — locked to your brand, streamed slide by slide.
        </p>
      </main>

      <GenerateBox />
    </div>
  );
}
