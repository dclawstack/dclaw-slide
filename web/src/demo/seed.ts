/**
 * ─────────────────────────────────────────────────────────────────────────
 *  DEMO DATA MODULE — self-contained, easy to remove.
 *
 *  To delete the demo feature entirely:
 *    1. Delete this folder:            src/demo/
 *    2. Delete the API route:          src/app/api/demo/
 *    3. Delete the control component:  src/components/demo-data-controls.tsx
 *    4. Remove <DemoDataControls/> + its import from src/app/page.tsx
 *
 *  All demo records live in a workspace named "__demo__", so clearing is a
 *  single cascade delete that never touches real user data (which lives in
 *  the "default" workspace).
 * ─────────────────────────────────────────────────────────────────────────
 */
import { eq } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import type { DeckJson } from "@/lib/deck/types";
import { DEMO_DECKS } from "./decks";

export const DEMO_WORKSPACE = "__demo__";

export interface DemoStatus {
  seeded: boolean;
  decks: number;
}

async function findDemoWorkspace() {
  return db().query.workspaces.findFirst({
    where: eq(schema.workspaces.name, DEMO_WORKSPACE),
  });
}

export async function demoStatus(): Promise<DemoStatus> {
  if (!hasDb()) return { seeded: false, decks: 0 };
  const ws = await findDemoWorkspace();
  if (!ws) return { seeded: false, decks: 0 };
  const rows = await db()
    .select({ id: schema.decks.id })
    .from(schema.decks)
    .where(eq(schema.decks.workspaceId, ws.id));
  return { seeded: rows.length > 0, decks: rows.length };
}

export async function clearDemo(): Promise<{ removed: boolean }> {
  if (!hasDb()) return { removed: false };
  const ws = await findDemoWorkspace();
  if (!ws) return { removed: false };
  // Cascades to decks → deck_events, ingested_files → brand_chunks, share_links.
  await db().delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
  return { removed: true };
}

export async function seedDemo(): Promise<DemoStatus> {
  if (!hasDb()) return { seeded: false, decks: 0 };

  // Idempotent: wipe any prior demo data first.
  await clearDemo();

  const [ws] = await db()
    .insert(schema.workspaces)
    .values({ name: DEMO_WORKSPACE })
    .returning();

  // Brand library content so retrieval has something to find.
  const [file] = await db()
    .insert(schema.ingestedFiles)
    .values({
      workspaceId: ws.id,
      filename: "brand-voice-guide.md",
      kind: "markdown",
      slideCount: null,
    })
    .returning();
  await db()
    .insert(schema.brandChunks)
    .values(
      BRAND_CHUNKS.map((content) => ({
        workspaceId: ws.id,
        fileId: file.id,
        content,
      }))
    );

  // Decks + analytics.
  for (const demo of DEMO_DECKS) {
    const [deck] = await db()
      .insert(schema.decks)
      .values({
        workspaceId: ws.id,
        title: demo.deck.title,
        status: "ready",
        sourcePrompt: demo.prompt,
        deckJson: demo.deck as DeckJson,
        generationMeta: { demo: true },
      })
      .returning({ id: schema.decks.id });

    const events: { deckId: string; type: "view" | "present" | "share_view" }[] =
      [];
    for (let i = 0; i < demo.views; i++)
      events.push({ deckId: deck.id, type: "view" });
    for (let i = 0; i < demo.presents; i++)
      events.push({ deckId: deck.id, type: "present" });
    for (let i = 0; i < demo.shareViews; i++)
      events.push({ deckId: deck.id, type: "share_view" });
    if (events.length) await db().insert(schema.deckEvents).values(events);
  }

  return demoStatus();
}

const BRAND_CHUNKS = [
  "Our voice is confident but never hype. Short sentences. Concrete numbers over adjectives. We say 'ships today', not 'revolutionary'.",
  "Brand colors: primary pink #EC4899, ink #18181b. Headlines are bold and short; body copy stays under 20 words per line.",
  "Every customer deck opens with the customer's outcome, not our product. Lead with their win, then show how we got there.",
  "Pricing is always framed per-seat per-month with annual options. Never lead with discounts; lead with value delivered.",
];
