import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import { getAuth } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const auth = hasDb() ? await getAuth() : null;
  if (hasDb() && !auth) redirect("/login?next=/dashboard");

  const decks = auth
    ? await db()
        .select({
          id: schema.decks.id,
          title: schema.decks.title,
          status: schema.decks.status,
          createdAt: schema.decks.createdAt,
          views: sql<number>`(select count(*)::int from ${schema.deckEvents}
            where ${schema.deckEvents.deckId} = ${schema.decks.id}
            and ${schema.deckEvents.type} = 'view')`,
        })
        .from(schema.decks)
        .where(eq(schema.decks.workspaceId, auth.workspaceId))
        .orderBy(desc(schema.decks.createdAt))
        .limit(50)
    : [];

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-3xl flex flex-col gap-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Your decks</h1>
          <span className="flex items-center gap-4">
            {auth && <LogoutButton email={auth.email} />}
            <Link
              href="/new"
              className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-500"
            >
              + New deck
            </Link>
          </span>
        </header>

        {!hasDb() && (
          <p className="text-zinc-500 text-sm">
            Database not connected yet — decks aren&apos;t persisted. (Waiting
            on NEON_API_KEY in BUILD-INPUTS.md.)
          </p>
        )}

        {hasDb() && decks.length === 0 && (
          <p className="text-zinc-500 text-sm">
            No decks yet.{" "}
            <Link href="/new" className="text-pink-400 hover:text-pink-300">
              Generate your first one →
            </Link>
          </p>
        )}

        <ul className="flex flex-col divide-y divide-zinc-800">
          {decks.map((deck) => (
            <li key={deck.id}>
              <Link
                href={`/deck/${deck.id}`}
                className="flex items-center justify-between py-4 hover:bg-zinc-900/50 px-2 rounded-lg"
              >
                <span className="font-medium">{deck.title}</span>
                <span className="flex items-center gap-4 text-sm text-zinc-500">
                  <span>👁 {deck.views}</span>
                  <span
                    className={
                      deck.status === "ready"
                        ? "text-emerald-400"
                        : deck.status === "failed"
                          ? "text-red-400"
                          : "text-amber-400"
                    }
                  >
                    {deck.status}
                  </span>
                  {deck.createdAt.toISOString().slice(0, 10)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
