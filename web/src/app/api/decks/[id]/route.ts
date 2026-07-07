import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { DeckJsonSchema } from "@/lib/deck/types";
import { requireAuth } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const deck = await db().query.decks.findFirst({
    where: and(
      eq(schema.decks.id, id),
      eq(schema.decks.workspaceId, auth.workspaceId)
    ),
  });
  if (!deck) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(deck);
}

/** Update title and/or the full deck JSON (theme changes + block edits). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("editor");
  if (auth instanceof Response) return auth;
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
    .where(
      and(eq(schema.decks.id, id), eq(schema.decks.workspaceId, auth.workspaceId))
    )
    .returning({ id: schema.decks.id });
  if (!row) return Response.json({ error: "not found" }, { status: 404 });

  if (body.deckJson !== undefined) {
    await db()
      .insert(schema.deckEvents)
      .values({ deckId: id, type: "edit" })
      .catch(() => {});
  }
  await audit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.userId,
    action: "deck.update",
    targetType: "deck",
    targetId: id,
    meta: { fields: Object.keys(update).filter((k) => k !== "updatedAt") },
    ip: clientIp(req),
  });
  return Response.json({ ok: true });
}

/** Delete a deck (cascades to events and share links). Editor+. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("editor");
  if (auth instanceof Response) return auth;
  const { id } = await params;

  const [row] = await db()
    .delete(schema.decks)
    .where(
      and(eq(schema.decks.id, id), eq(schema.decks.workspaceId, auth.workspaceId))
    )
    .returning({ id: schema.decks.id, title: schema.decks.title });
  if (!row) return Response.json({ error: "not found" }, { status: 404 });

  await audit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.userId,
    action: "deck.delete",
    targetType: "deck",
    targetId: id,
    meta: { title: row.title },
    ip: clientIp(req),
  });
  return Response.json({ ok: true });
}
