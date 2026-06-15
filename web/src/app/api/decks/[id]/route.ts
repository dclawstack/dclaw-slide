import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import { DeckJsonSchema } from "@/lib/deck/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasDb()) return Response.json({ error: "no database" }, { status: 503 });
  const { id } = await params;
  const deck = await db().query.decks.findFirst({
    where: eq(schema.decks.id, id),
  });
  if (!deck) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(deck);
}

/** Update title and/or the full deck JSON (theme changes + block edits). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasDb()) return Response.json({ error: "no database" }, { status: 503 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "bad body" }, { status: 400 });

  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (body.deckJson !== undefined) {
    const parsed = DeckJsonSchema.safeParse(body.deckJson);
    if (!parsed.success) {
      return Response.json(
        { error: "invalid deck", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    update.deckJson = parsed.data;
    update.title = parsed.data.title;
  } else if (typeof body.title === "string") {
    update.title = body.title;
  }

  const [row] = await db()
    .update(schema.decks)
    .set(update)
    .where(eq(schema.decks.id, id))
    .returning({ id: schema.decks.id });
  if (!row) return Response.json({ error: "not found" }, { status: 404 });

  if (body.deckJson !== undefined) {
    await db()
      .insert(schema.deckEvents)
      .values({ deckId: id, type: "edit" })
      .catch(() => {});
  }
  return Response.json({ ok: true });
}
