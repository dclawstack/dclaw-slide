import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";

const SwitchSchema = z.object({ workspaceId: z.string().uuid() });

/** Switch the session's active workspace (must be a member). */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const parsed = SwitchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid workspace" }, { status: 400 });
  }

  const membership = await db().query.memberships.findFirst({
    where: and(
      eq(schema.memberships.userId, auth.userId),
      eq(schema.memberships.workspaceId, parsed.data.workspaceId)
    ),
  });
  if (!membership) {
    return Response.json({ error: "not a member of that workspace" }, { status: 403 });
  }

  await db()
    .update(schema.sessions)
    .set({ workspaceId: parsed.data.workspaceId })
    .where(eq(schema.sessions.id, auth.sessionId));

  return Response.json({ ok: true, workspaceId: parsed.data.workspaceId });
}
