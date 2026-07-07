import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

/**
 * Full workspace data export (GDPR/portability): decks, brand library,
 * share links (sans password hashes), events. Admin+.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth("admin");
  if (auth instanceof Response) return auth;
  const ws = auth.workspaceId;

  const [workspace, decks, files, chunks, events] = await Promise.all([
    db().query.workspaces.findFirst({ where: eq(schema.workspaces.id, ws) }),
    db().query.decks.findMany({ where: eq(schema.decks.workspaceId, ws) }),
    db().query.ingestedFiles.findMany({
      where: eq(schema.ingestedFiles.workspaceId, ws),
    }),
    db()
      .select({
        id: schema.brandChunks.id,
        fileId: schema.brandChunks.fileId,
        content: schema.brandChunks.content,
      })
      .from(schema.brandChunks)
      .where(eq(schema.brandChunks.workspaceId, ws)),
    db()
      .select({
        deckId: schema.deckEvents.deckId,
        type: schema.deckEvents.type,
        ts: schema.deckEvents.ts,
      })
      .from(schema.deckEvents)
      .innerJoin(schema.decks, eq(schema.decks.id, schema.deckEvents.deckId))
      .where(eq(schema.decks.workspaceId, ws)),
  ]);

  await audit({
    workspaceId: ws,
    actorUserId: auth.userId,
    action: "workspace.export",
    ip: clientIp(req),
  });

  return new Response(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        workspace: { id: workspace?.id, name: workspace?.name, plan: workspace?.plan },
        decks,
        brandFiles: files,
        brandChunks: chunks,
        events,
      },
      null,
      2
    ),
    {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="workspace-export.json"',
      },
    }
  );
}
