import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import { verifyPassword } from "@/lib/share";

async function loadLink(token: string) {
  return db().query.shareLinks.findFirst({
    where: eq(schema.shareLinks.token, token),
  });
}

async function loadDeck(deckId: string) {
  const deck = await db().query.decks.findFirst({
    where: eq(schema.decks.id, deckId),
    columns: { title: true, deckJson: true, status: true },
  });
  return deck?.deckJson ? { title: deck.title, deck: deck.deckJson } : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!hasDb()) {
    return Response.json({ error: "database not connected" }, { status: 503 });
  }
  const { token } = await params;
  const link = await loadLink(token);
  if (!link) return Response.json({ error: "not found" }, { status: 404 });
  if (link.passwordHash) {
    return Response.json({ passwordRequired: true }, { status: 401 });
  }
  const payload = await loadDeck(link.deckId);
  if (!payload) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(payload);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!hasDb()) {
    return Response.json({ error: "database not connected" }, { status: 503 });
  }
  const { token } = await params;
  const link = await loadLink(token);
  if (!link) return Response.json({ error: "not found" }, { status: 404 });

  const { password } = await req.json().catch(() => ({ password: "" }));
  if (
    link.passwordHash &&
    !(typeof password === "string" && verifyPassword(link.passwordHash, password))
  ) {
    return Response.json({ error: "wrong password" }, { status: 403 });
  }
  const payload = await loadDeck(link.deckId);
  if (!payload) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(payload);
}
