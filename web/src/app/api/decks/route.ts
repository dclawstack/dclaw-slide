import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import { generateDeck, type GenEvent } from "@/lib/ai/generate";
import { hasOpenRouter } from "@/lib/ai/openrouter";
import { DEMO_DECK } from "@/lib/demo-deck";
import { brandContextFor } from "@/lib/rag";
import { checkRateLimit } from "@/lib/rate-limit";
import type { DeckJson } from "@/lib/deck/types";

export const maxDuration = 300;

// Generation invokes paid models — keep this tight.
const GEN_LIMIT = { limit: 5, windowMs: 60_000 };

type StreamEvent = GenEvent | { type: "created"; deckId: string | null };

async function getDefaultWorkspaceId(): Promise<string> {
  // Pin real decks to the "default" workspace so they're never swept up by
  // demo seed/clear (which uses the "__demo__" workspace).
  const existing = await db().query.workspaces.findFirst({
    where: eq(schema.workspaces.name, "default"),
  });
  if (existing) return existing.id;
  const [ws] = await db()
    .insert(schema.workspaces)
    .values({ name: "default" })
    .returning();
  return ws.id;
}

/** Demo-mode generator: streams the canned deck so the UX is testable keyless. */
async function* demoGenerate(): AsyncGenerator<GenEvent> {
  yield {
    type: "status",
    message: "Demo mode (no OPENROUTER_API_KEY) — streaming sample deck…",
  };
  for (let i = 0; i < DEMO_DECK.slides.length; i++) {
    await new Promise((r) => setTimeout(r, 400));
    yield { type: "slide", slide: DEMO_DECK.slides[i], index: i };
  }
  yield {
    type: "done",
    deck: DEMO_DECK,
    meta: {
      models: { outliners: ["demo"], judge: "demo", designer: "demo" },
      usage: {},
      durationMs: DEMO_DECK.slides.length * 400,
    },
  };
}

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, "deck-gen", GEN_LIMIT);
  if (limited) return limited;

  const { prompt } = await req.json().catch(() => ({ prompt: "" }));
  if (typeof prompt !== "string" || prompt.trim().length < 3) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  let deckId: string | null = null;
  if (hasDb()) {
    const workspaceId = await getDefaultWorkspaceId();
    const [row] = await db()
      .insert(schema.decks)
      .values({ workspaceId, sourcePrompt: prompt.trim(), title: "Generating…" })
      .returning({ id: schema.decks.id });
    deckId = row.id;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      send({ type: "created", deckId });

      const brandContext = await brandContextFor(prompt).catch(() => "");
      const gen = hasOpenRouter()
        ? generateDeck(prompt.trim(), brandContext)
        : demoGenerate();

      try {
        for await (const event of gen) {
          send(event);
          if (deckId && event.type === "done") {
            await persistDeck(deckId, event.deck, event.meta, "ready");
          }
          if (deckId && event.type === "error") {
            await persistDeck(deckId, null, null, "failed");
          }
        }
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
        if (deckId) await persistDeck(deckId, null, null, "failed");
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function persistDeck(
  deckId: string,
  deck: DeckJson | null,
  meta: unknown,
  status: "ready" | "failed"
) {
  try {
    await db()
      .update(schema.decks)
      .set({
        status,
        ...(deck ? { title: deck.title, deckJson: deck } : {}),
        ...(meta ? { generationMeta: meta } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.decks.id, deckId));
  } catch (err) {
    console.error("persistDeck failed:", err);
  }
}

export async function GET() {
  if (!hasDb()) return Response.json({ decks: [], db: false });
  const rows = await db()
    .select({
      id: schema.decks.id,
      title: schema.decks.title,
      status: schema.decks.status,
      createdAt: schema.decks.createdAt,
    })
    .from(schema.decks)
    .orderBy(desc(schema.decks.createdAt))
    .limit(50);
  return Response.json({ decks: rows, db: true });
}
