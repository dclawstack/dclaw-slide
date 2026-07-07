import { NextRequest } from "next/server";
import { count, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { limitsFor } from "@/lib/plans";
import { monthlyUsage } from "@/lib/usage";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const [workspace] = await db()
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, auth.workspaceId));
  if (!workspace) return Response.json({ error: "not found" }, { status: 404 });

  const [[members], usage] = await Promise.all([
    db()
      .select({ count: count() })
      .from(schema.memberships)
      .where(eq(schema.memberships.workspaceId, auth.workspaceId)),
    monthlyUsage(auth.workspaceId),
  ]);

  return Response.json({
    id: workspace.id,
    name: workspace.name,
    plan: workspace.plan,
    limits: limitsFor(workspace.plan),
    usage,
    members: members.count,
    role: auth.role,
  });
}

/** Delete the workspace and all its data. Owner only. */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth("owner");
  if (auth instanceof Response) return auth;

  // Audit before the cascade removes the log's parent row.
  await audit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.userId,
    action: "workspace.delete",
    ip: clientIp(req),
  });

  // Cascades to decks, files, chunks, share links, events, memberships,
  // sessions, invites, audit log, usage events.
  await db()
    .delete(schema.workspaces)
    .where(eq(schema.workspaces.id, auth.workspaceId));

  return Response.json({ ok: true });
}
