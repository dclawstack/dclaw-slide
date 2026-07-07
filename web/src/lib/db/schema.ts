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
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------- App tables ----------

export const PLANS = ["free", "pro", "enterprise"] as const;
export type Plan = (typeof PLANS)[number];

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  plan: text("plan", { enum: PLANS }).notNull().default("free"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- Identity & access ----------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ROLES = ["viewer", "editor", "admin", "owner"] as const;
export type Role = (typeof ROLES)[number];

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    role: text("role", { enum: ROLES }).notNull().default("editor"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("memberships_user_workspace_idx").on(t.userId, t.workspaceId)]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // sha256 of the cookie token — raw tokens are never stored.
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Active workspace for this session.
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

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
  expiresAt: timestamp("expires_at"),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
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

// ---------- Governance & billing ----------

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(), // e.g. "deck.create", "member.role_change"
    targetType: text("target_type"),
    targetId: text("target_id"),
    meta: jsonb("meta"),
    ip: text("ip"),
    ts: timestamp("ts").notNull().defaultNow(),
  },
  (t) => [index("audit_log_workspace_ts_idx").on(t.workspaceId, t.ts)]
);

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  role: text("role", { enum: ROLES }).notNull().default("editor"),
  email: text("email"), // optional restriction: only this email may accept
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedBy: uuid("accepted_by").references(() => users.id, {
    onDelete: "set null",
  }),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["generation", "ingest"] }).notNull(),
    tokens: integer("tokens"),
    costUsd: numeric("cost_usd"),
    deckId: uuid("deck_id").references(() => decks.id, { onDelete: "set null" }),
    meta: jsonb("meta"),
    ts: timestamp("ts").notNull().defaultNow(),
  },
  (t) => [index("usage_events_workspace_ts_idx").on(t.workspaceId, t.ts)]
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
