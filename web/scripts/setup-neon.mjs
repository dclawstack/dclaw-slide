#!/usr/bin/env node
/**
 * One-shot Neon provisioning:
 *   1. Creates (or finds) the Neon project "dclaw-slide"
 *   2. Runs the drizzle migration SQL (includes pgvector extension)
 *   3. Seeds roadmap_items with the build plan
 *   4. Prints the DATABASE_URL to wire into Vercel + .env.local
 *
 * Usage: NEON_API_KEY=... node scripts/setup-neon.mjs
 * (or it reads NEON_API_KEY from ../BUILD-INPUTS.md)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = "https://console.neon.tech/api/v2";
const PROJECT_NAME = "dclaw-slide";

function readKeyFromBuildInputs() {
  try {
    const md = readFileSync(join(__dirname, "../../BUILD-INPUTS.md"), "utf8");
    const m = md.match(/^NEON_API_KEY=(.+)$/m);
    const v = m?.[1]?.trim();
    return v && v !== "FILL_ME" ? v : null;
  } catch {
    return null;
  }
}

const KEY = process.env.NEON_API_KEY || readKeyFromBuildInputs();
if (!KEY) {
  console.error("No NEON_API_KEY in env or BUILD-INPUTS.md");
  process.exit(1);
}

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// 1. Find or create project
let project;
const existing = await api("/projects?limit=100");
project = existing.projects?.find((p) => p.name === PROJECT_NAME);
let connectionUri;
if (project) {
  console.log(`Found existing Neon project: ${project.id}`);
  const uris = await api(
    `/projects/${project.id}/connection_uri?database_name=neondb&role_name=neondb_owner`
  );
  connectionUri = uris.uri;
} else {
  const created = await api("/projects", {
    method: "POST",
    body: JSON.stringify({
      project: { name: PROJECT_NAME, pg_version: 17 },
    }),
  });
  project = created.project;
  connectionUri = created.connection_uris?.[0]?.connection_uri;
  console.log(`Created Neon project: ${project.id}`);
}
if (!connectionUri) throw new Error("No connection URI returned");

// 2. Run migrations over the HTTP driver
const { neon } = await import("@neondatabase/serverless");
const sql = neon(connectionUri);

const migrationsDir = join(__dirname, "../drizzle");
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
for (const file of migrations) {
  const content = readFileSync(join(migrationsDir, file), "utf8");
  const statements = content
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log(`Applied migration: ${file} (${statements.length} statements)`);
}

// 3. Seed roadmap (idempotent — skips if already seeded)
const [{ count }] = await sql`SELECT count(*)::int AS count FROM roadmap_items`;
if (Number(count) === 0) {
  const items = [
    ["P0 foundation", "Next.js scaffold + Vercel auto-deploy", "done", 0],
    ["P0 foundation", "Drizzle schema + Neon provisioning", "done", 0],
    ["P0 foundation", "Consensus pipeline (outline→judge→designer)", "done", 1],
    ["P0 foundation", "SSE streaming generation UI", "done", 1],
    ["P0 foundation", "Dashboard + deck permalinks", "done", 0],
    ["P1 wedge", "PPTX ingest → brand chunks", "done", 1],
    ["P1 wedge", "Brand RAG: keyword retrieval v0", "done", 1],
    ["P1 wedge", "Brand RAG: pgvector embeddings", "pending", 1],
    ["P1 wedge", "Live E2E generation with OpenRouter", "pending", 1],
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
  console.log(`Seeded ${items.length} roadmap items`);
} else {
  console.log(`Roadmap already seeded (${count} items)`);
}

await sql`INSERT INTO build_log (event, detail) VALUES ('neon-provisioned', ${project.id})`;

console.log("\nDATABASE_URL (add to Vercel env + web/.env.local):");
console.log(connectionUri);
