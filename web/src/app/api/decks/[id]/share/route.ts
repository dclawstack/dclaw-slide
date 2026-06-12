import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { hashPassword } from "@/lib/share";
import { db, hasDb, schema } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasDb()) {
    return Response.json({ error: "database not connected" }, { status: 503 });
  }
  const { id } = await params;
  const deck = await db().query.decks.findFirst({
    where: eq(schema.decks.id, id),
    columns: { id: true },
  });
  if (!deck) return Response.json({ error: "deck not found" }, { status: 404 });

  const { password } = await req.json().catch(() => ({ password: undefined }));

  const [link] = await db()
    .insert(schema.shareLinks)
    .values({
      deckId: id,
      token: nanoid(21),
      passwordHash:
        typeof password === "string" && password.length > 0
          ? hashPassword(password)
          : null,
    })
    .returning({ token: schema.shareLinks.token });

  return Response.json({ url: `/s/${link.token}` });
}
