import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { hashPassword } from "@/lib/share";
import { db, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

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

  const { password, expiresInDays } = await req
    .json()
    .catch(() => ({ password: undefined, expiresInDays: undefined }));

  let expiresAt: Date | null = null;
  if (expiresInDays !== undefined && expiresInDays !== null) {
    const days = Number(expiresInDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return Response.json(
        { error: "expiresInDays must be 1–365" },
        { status: 400 }
      );
    }
    expiresAt = new Date(Date.now() + days * 86_400_000);
  }

  const [link] = await db()
    .insert(schema.shareLinks)
    .values({
      deckId: id,
      token: nanoid(21),
      passwordHash:
        typeof password === "string" && password.length > 0
          ? hashPassword(password)
          : null,
      expiresAt,
      createdBy: auth.userId,
    })
    .returning({ token: schema.shareLinks.token });

  await audit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.userId,
    action: "share.create",
    targetType: "deck",
    targetId: id,
    meta: {
      protected: typeof password === "string" && password.length > 0,
      expiresAt: expiresAt?.toISOString() ?? null,
    },
    ip: clientIp(req),
  });
  return Response.json({ url: `/s/${link.token}` });
}
