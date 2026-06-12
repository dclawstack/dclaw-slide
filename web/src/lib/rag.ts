import { sql } from "drizzle-orm";
import { db, hasDb } from "@/lib/db";

/**
 * Retrieve brand context for a generation prompt.
 *
 * v0: keyword scoring over brand_chunks (works with zero embeddings).
 * Once OPENROUTER_API_KEY lands, chunks get embeddings on ingest and this
 * switches to pgvector cosine search — same call site, better recall.
 */
export async function brandContextFor(
  prompt: string,
  maxChunks = 10
): Promise<string> {
  if (!hasDb()) return "";

  const words = [
    ...new Set(
      prompt
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3)
    ),
  ].slice(0, 12);
  if (words.length === 0) return "";

  try {
    const rows = await db().execute(
      sql.raw(
        `SELECT content, (${words
          .map((_, i) => `(content ILIKE '%' || '${words[i].replace(/'/g, "''")}' || '%')::int`)
          .join(" + ")}) AS score
         FROM brand_chunks
         ORDER BY score DESC, id DESC
         LIMIT ${maxChunks}`
      )
    );
    const hits = (rows.rows as { content: string; score: number }[]).filter(
      (r) => Number(r.score) > 0
    );
    if (hits.length === 0) return "";
    return hits.map((r) => `- ${r.content}`).join("\n");
  } catch {
    return ""; // table missing / db unreachable — generation degrades gracefully
  }
}
