#!/usr/bin/env node
/**
 * Idempotent DB setup, run at build time (Vercel injects DATABASE_URL).
 *   1. CREATE EXTENSION vector
 *   2. drizzle migrate (tracked in __drizzle_migrations — safe to re-run)
 *   3. seed roadmap_items once
 *
 * Skips cleanly (exit 0) when DATABASE_URL is absent, so local builds and
 * the keyless demo keep working. Fails the build (exit 1) on a real
 * migration error so a broken schema never ships silently.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[db-setup] No DATABASE_URL — skipping (demo/local build).");
  process.exit(0);
}

try {
  const sql = neon(url);
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("[db-setup] pgvector ready");

  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[db-setup] migrations applied");

  const rows = await sql`SELECT count(*)::int AS count FROM roadmap_items`;
  if (Number(rows[0].count) === 0) {
    const items = [
      ["P0 foundation", "Next.js scaffold + Vercel auto-deploy", "done", 0],
      ["P0 foundation", "Drizzle schema + Neon provisioning", "done", 0],
      ["P0 foundation", "Consensus pipeline (outline→judge→designer)", "done", 1],
      ["P0 foundation", "SSE streaming generation UI", "done", 1],
      ["P0 foundation", "Dashboard + deck permalinks", "done", 0],
      ["P1 wedge", "PPTX ingest → brand chunks", "done", 1],
      ["P1 wedge", "Brand RAG: keyword retrieval v0", "done", 1],
      ["P1 wedge", "Brand RAG: pgvector embeddings", "pending", 1],
      ["P1 wedge", "Live E2E generation with OpenRouter", "done", 1],
      ["P1 wedge", "Share links + print-to-PDF export", "done", 0],
      ["P2 polish", "Deck editing (block-level)", "pending", 2],
      ["P2 polish", "Auth + multi-workspace", "pending", 2],
      ["P2 polish", "Usage metering + Stripe", "pending", 2],
      ["P2 polish", "North-star metric: decks/workspace/week", "pending", 1],
    ];
    for (const [phase, title, status, complexity] of items) {
      await sql`INSERT INTO roadmap_items (phase, title, status, complexity, completed_at)
                VALUES (${phase}, ${title}, ${status}, ${complexity},
                        ${status === "done" ? new Date() : null})`;
    }
    console.log(`[db-setup] seeded ${items.length} roadmap items`);
  } else {
    console.log(`[db-setup] roadmap already seeded (${rows[0].count} items)`);
  }

  await sql`INSERT INTO build_log (event, detail) VALUES ('db-setup', ${process.env.VERCEL_GIT_COMMIT_SHA ?? "local"})`;
  console.log("[db-setup] done");
} catch (err) {
  console.error("[db-setup] FAILED:", err);
  process.exit(1);
}
