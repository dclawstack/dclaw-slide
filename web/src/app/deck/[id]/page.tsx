import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import { DeckJsonSchema } from "@/lib/deck/types";
import { DeckWorkspace } from "@/components/deck-workspace";

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
        Database not connected yet.
      </div>
    );
  }

  const row = await db().query.decks.findFirst({
    where: eq(schema.decks.id, id),
  });
  if (!row) notFound();

  // Record a view, then read aggregate counts.
  await db()
    .insert(schema.deckEvents)
    .values({ deckId: id, type: "view" })
    .catch(() => {});
  const counts = await db()
    .select({ type: schema.deckEvents.type, n: sql<number>`count(*)::int` })
    .from(schema.deckEvents)
    .where(eq(schema.deckEvents.deckId, id))
    .groupBy(schema.deckEvents.type);
  const stat = (k: string) => counts.find((c) => c.type === k)?.n ?? 0;

  const parsed = row.deckJson ? DeckJsonSchema.safeParse(row.deckJson) : null;

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-balance">{row.title}</h1>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-zinc-200 shrink-0"
          >
            ← Dashboard
          </Link>
        </header>

        <div className="flex gap-5 text-sm text-zinc-500">
          <span>👁 {stat("view")} views</span>
          <span>▶ {stat("present")} presented</span>
          <span>🔗 {stat("share_view")} share opens</span>
          <span>✎ {stat("edit")} edits</span>
        </div>

        {row.status === "generating" && (
          <p className="text-amber-400 text-sm">Still generating…</p>
        )}
        {row.status === "failed" && (
          <p className="text-red-400 text-sm">Generation failed.</p>
        )}

        {parsed?.success && (
          <DeckWorkspace deckId={id} initialDeck={parsed.data} />
        )}
      </div>
    </div>
  );
}
