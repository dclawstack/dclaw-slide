CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE "brand_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536)
);
--> statement-breakpoint
CREATE TABLE "build_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" text NOT NULL,
	"detail" text,
	"ts" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" numeric NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text DEFAULT 'Untitled deck' NOT NULL,
	"status" text DEFAULT 'generating' NOT NULL,
	"source_prompt" text NOT NULL,
	"deck_json" jsonb,
	"generation_meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingested_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"kind" text NOT NULL,
	"slide_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmap_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"complexity" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"token" text NOT NULL,
	"password_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_chunks" ADD CONSTRAINT "brand_chunks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_chunks" ADD CONSTRAINT "brand_chunks_file_id_ingested_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."ingested_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decks" ADD CONSTRAINT "decks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingested_files" ADD CONSTRAINT "ingested_files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_chunks_embedding_idx" ON "brand_chunks" USING hnsw ("embedding" vector_cosine_ops);