import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { logger, errField } from "@/lib/logger";

// share_view is recorded server-side by the share route, not via this API.
const VALID = new Set(["view", "present", "edit"]);

/** Fire-and-forget analytics event recording. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasDb()) return Response.json({ ok: false });
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const { type, sessionId } = await req
    .json()
    .catch(() => ({ type: undefined }));
  if (!VALID.has(type)) {
    return Response.json({ error: "bad type" }, { status: 400 });
  }
  const deck = await db().query.decks.findFirst({
    where: and(
      eq(schema.decks.id, id),
      eq(schema.decks.workspaceId, auth.workspaceId)
    ),
    columns: { id: true },
  });
  if (!deck) return Response.json({ error: "not found" }, { status: 404 });
  await db()
    .insert(schema.deckEvents)
    .values({ deckId: id, type, sessionId: sessionId ?? null })
    .catch((err) => logger.warn("deck event insert failed", errField(err)));
  return Response.json({ ok: true });
}
