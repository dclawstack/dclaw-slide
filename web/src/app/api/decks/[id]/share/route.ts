import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { hashPassword } from "@/lib/share";
import { db, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("editor");
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const deck = await db().query.decks.findFirst({
    where: and(
      eq(schema.decks.id, id),
      eq(schema.decks.workspaceId, auth.workspaceId)
    ),
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
