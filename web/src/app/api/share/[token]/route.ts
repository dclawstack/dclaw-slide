import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import { verifyPassword } from "@/lib/share";
import { checkRateLimit } from "@/lib/rate-limit";

async function loadLink(token: string) {
  const link = await db().query.shareLinks.findFirst({
    where: eq(schema.shareLinks.token, token),
  });
  if (link?.expiresAt && link.expiresAt.getTime() < Date.now()) {
    return { expired: true as const, link };
  }
  return link ? { expired: false as const, link } : null;
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
  const result = await loadLink(token);
  if (!result) return Response.json({ error: "not found" }, { status: 404 });
  if (result.expired) {
    return Response.json({ error: "this link has expired" }, { status: 410 });
  }
  const { link } = result;
  if (link.passwordHash) {
    return Response.json({ passwordRequired: true }, { status: 401 });
  }
  const payload = await loadDeck(link.deckId);
  if (!payload) return Response.json({ error: "not found" }, { status: 404 });
  await db()
    .insert(schema.deckEvents)
    .values({ deckId: link.deckId, type: "share_view" })
    .catch(() => {});
  return Response.json(payload);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // Throttle password attempts on protected share links.
  const limited = checkRateLimit(req, "share-unlock", {
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;
  if (!hasDb()) {
    return Response.json({ error: "database not connected" }, { status: 503 });
  }
  const { token } = await params;
  const result = await loadLink(token);
  if (!result) return Response.json({ error: "not found" }, { status: 404 });
  if (result.expired) {
    return Response.json({ error: "this link has expired" }, { status: 410 });
  }
  const { link } = result;

  const { password } = await req.json().catch(() => ({ password: "" }));
  if (
    link.passwordHash &&
    !(typeof password === "string" && verifyPassword(link.passwordHash, password))
  ) {
    return Response.json({ error: "wrong password" }, { status: 403 });
  }
  const payload = await loadDeck(link.deckId);
  if (!payload) return Response.json({ error: "not found" }, { status: 404 });
  await db()
    .insert(schema.deckEvents)
    .values({ deckId: link.deckId, type: "share_view" })
    .catch(() => {});
  return Response.json(payload);
}
