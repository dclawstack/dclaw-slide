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
 *  Demo records are seeded into the caller's own workspace and tagged
 *  (decks via generationMeta.demo, files via a "[demo] " filename prefix),
 *  so clearing removes exactly what seeding created and never touches
 *  real user data.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { and, eq, like, sql } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import type { DeckJson } from "@/lib/deck/types";
import { DEMO_DECKS } from "./decks";

const DEMO_FILE_PREFIX = "[demo] ";
const demoDeckFilter = (workspaceId: string) =>
  and(
    eq(schema.decks.workspaceId, workspaceId),
    sql`${schema.decks.generationMeta}->>'demo' = 'true'`
  );

export interface DemoStatus {
  seeded: boolean;
  decks: number;
}

export async function demoStatus(workspaceId: string): Promise<DemoStatus> {
  if (!hasDb()) return { seeded: false, decks: 0 };
  const rows = await db()
    .select({ id: schema.decks.id })
    .from(schema.decks)
    .where(demoDeckFilter(workspaceId));
  return { seeded: rows.length > 0, decks: rows.length };
}

export async function clearDemo(
  workspaceId: string
): Promise<{ removed: boolean }> {
  if (!hasDb()) return { removed: false };
  // Deck deletes cascade to deck_events and share_links; file deletes
  // cascade to brand_chunks.
  const removedDecks = await db()
    .delete(schema.decks)
    .where(demoDeckFilter(workspaceId))
    .returning({ id: schema.decks.id });
  const removedFiles = await db()
    .delete(schema.ingestedFiles)
    .where(
      and(
        eq(schema.ingestedFiles.workspaceId, workspaceId),
        like(schema.ingestedFiles.filename, `${DEMO_FILE_PREFIX}%`)
      )
    )
    .returning({ id: schema.ingestedFiles.id });
  return { removed: removedDecks.length > 0 || removedFiles.length > 0 };
}

export async function seedDemo(workspaceId: string): Promise<DemoStatus> {
  if (!hasDb()) return { seeded: false, decks: 0 };

  // Idempotent: wipe any prior demo data first.
  await clearDemo(workspaceId);

  // Brand library content so retrieval has something to find.
  const [file] = await db()
    .insert(schema.ingestedFiles)
    .values({
      workspaceId,
      filename: `${DEMO_FILE_PREFIX}brand-voice-guide.md`,
      kind: "markdown",
      slideCount: null,
    })
    .returning();
  await db()
    .insert(schema.brandChunks)
    .values(
      BRAND_CHUNKS.map((content) => ({
        workspaceId,
        fileId: file.id,
        content,
      }))
    );

  // Decks + analytics.
  for (const demo of DEMO_DECKS) {
    const [deck] = await db()
      .insert(schema.decks)
      .values({
        workspaceId,
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

  return demoStatus(workspaceId);
}

const BRAND_CHUNKS = [
  "Our voice is confident but never hype. Short sentences. Concrete numbers over adjectives. We say 'ships today', not 'revolutionary'.",
  "Brand colors: primary pink #EC4899, ink #18181b. Headlines are bold and short; body copy stays under 20 words per line.",
  "Every customer deck opens with the customer's outcome, not our product. Lead with their win, then show how we got there.",
  "Pricing is always framed per-seat per-month with annual options. Never lead with discounts; lead with value delivered.",
];
