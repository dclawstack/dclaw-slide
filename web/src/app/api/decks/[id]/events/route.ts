import { NextRequest } from "next/server";
import { db, hasDb, schema } from "@/lib/db";

const VALID = new Set(["view", "present", "share_view", "edit"]);

/** Fire-and-forget analytics event recording. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasDb()) return Response.json({ ok: false });
  const { id } = await params;
  const { type, sessionId } = await req
    .json()
    .catch(() => ({ type: undefined }));
  if (!VALID.has(type)) {
    return Response.json({ error: "bad type" }, { status: 400 });
  }
  await db()
    .insert(schema.deckEvents)
    .values({ deckId: id, type, sessionId: sessionId ?? null })
    .catch(() => {});
  return Response.json({ ok: true });
}
