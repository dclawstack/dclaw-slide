import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import { getAuth } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

async function loadOpenInvite(token: string) {
  const invite = await db().query.invites.findFirst({
    where: and(eq(schema.invites.token, token), isNull(schema.invites.acceptedAt)),
  });
  if (!invite || invite.expiresAt.getTime() < Date.now()) return null;
  return invite;
}

/** Public: describe the invite so the join page can render. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = checkRateLimit(req, "invite-info", {
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;
  if (!hasDb()) return Response.json({ error: "no database" }, { status: 503 });

  const { token } = await params;
  const invite = await loadOpenInvite(token);
  if (!invite) {
    return Response.json({ error: "invite not found or expired" }, { status: 404 });
  }
  const workspace = await db().query.workspaces.findFirst({
    where: eq(schema.workspaces.id, invite.workspaceId),
    columns: { name: true },
  });
  return Response.json({
    workspaceName: workspace?.name ?? "workspace",
    role: invite.role,
    emailRestricted: Boolean(invite.email),
  });
}

/** Accept the invite as the signed-in user. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!hasDb()) return Response.json({ error: "no database" }, { status: 503 });
  const auth = await getAuth();
  if (!auth) {
    return Response.json({ error: "sign in to accept the invite" }, { status: 401 });
  }

  const { token } = await params;
  const invite = await loadOpenInvite(token);
  if (!invite) {
    return Response.json({ error: "invite not found or expired" }, { status: 404 });
  }
  if (invite.email && invite.email !== auth.email) {
    return Response.json(
      { error: "this invite is for a different email address" },
      { status: 403 }
    );
  }

  const existing = await db().query.memberships.findFirst({
    where: and(
      eq(schema.memberships.userId, auth.userId),
      eq(schema.memberships.workspaceId, invite.workspaceId)
    ),
  });
  if (!existing) {
    await db().insert(schema.memberships).values({
      userId: auth.userId,
      workspaceId: invite.workspaceId,
      role: invite.role,
    });
  }
  await db()
    .update(schema.invites)
    .set({ acceptedBy: auth.userId, acceptedAt: new Date() })
    .where(eq(schema.invites.id, invite.id));

  await audit({
    workspaceId: invite.workspaceId,
    actorUserId: auth.userId,
    action: "member.join",
    targetType: "user",
    targetId: auth.userId,
    meta: { via: "invite", role: invite.role },
    ip: clientIp(req),
  });
  return Response.json({ ok: true, workspaceId: invite.workspaceId });
}
