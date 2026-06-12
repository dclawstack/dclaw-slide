import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import { DeckJsonSchema } from "@/lib/deck/types";
import { SlideView } from "@/components/slide-view";

export const dynamic = "force-dynamic";

export default async function DeckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!hasDb()) {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-500">
        Database not connected yet — permalinks need NEON_API_KEY.
      </div>
    );
  }

  const row = await db().query.decks.findFirst({
    where: eq(schema.decks.id, id),
  });
  if (!row) notFound();

  const parsed = row.deckJson
    ? DeckJsonSchema.safeParse(row.deckJson)
    : null;

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-3xl flex flex-col gap-8">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-balance">{row.title}</h1>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-zinc-200 shrink-0"
          >
            ← Dashboard
          </Link>
        </header>

        {row.status === "generating" && (
          <p className="text-amber-400 text-sm">Still generating…</p>
        )}
        {row.status === "failed" && (
          <p className="text-red-400 text-sm">Generation failed.</p>
        )}

        {parsed?.success && (
          <div className="flex flex-col gap-6">
            {parsed.data.slides.map((slide) => (
              <SlideView key={slide.id} slide={slide} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
