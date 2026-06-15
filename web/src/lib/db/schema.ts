import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  numeric,
  vector,
  index,
} from "drizzle-orm/pg-core";

// ---------- App tables ----------

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const decks = pgTable("decks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Untitled deck"),
  status: text("status", {
    enum: ["generating", "ready", "failed"],
  })
    .notNull()
    .default("generating"),
  sourcePrompt: text("source_prompt").notNull(),
  deckJson: jsonb("deck_json"),
  generationMeta: jsonb("generation_meta"), // models used, tokens, cost, timings
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ingestedFiles = pgTable("ingested_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  kind: text("kind", { enum: ["pptx", "markdown", "text"] }).notNull(),
  slideCount: integer("slide_count"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const brandChunks = pgTable(
  "brand_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => ingestedFiles.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
  },
  (t) => [
    index("brand_chunks_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops")
    ),
  ]
);

export const shareLinks = pgTable("share_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  deckId: uuid("deck_id")
    .notNull()
    .references(() => decks.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const deckEvents = pgTable(
  "deck_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["view", "present", "share_view", "edit"],
    }).notNull(),
    sessionId: text("session_id"),
    ts: timestamp("ts").notNull().defaultNow(),
  },
  (t) => [index("deck_events_deck_idx").on(t.deckId)]
);

// ---------- Build/roadmap tracking (the agent's own progress ledger) ----------

export const roadmapItems = pgTable("roadmap_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  phase: text("phase").notNull(), // e.g. "P0 foundation", "P1 wedge", "P2 polish"
  title: text("title").notNull(),
  status: text("status", {
    enum: ["pending", "in_progress", "done", "blocked"],
  })
    .notNull()
    .default("pending"),
  complexity: integer("complexity").notNull().default(0),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const buildMetrics = pgTable("build_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(), // e.g. "decks_generated", "gen_cost_usd", "gen_latency_ms"
  value: numeric("value").notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export const buildLog = pgTable("build_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  event: text("event").notNull(),
  detail: text("detail"),
  ts: timestamp("ts").notNull().defaultNow(),
});
