import { NextRequest } from "next/server";
import { z } from "zod";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ROLES } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

const PatchSchema = z.object({ role: z.enum(ROLES) });

async function membershipOf(userId: string, workspaceId: string) {
  return db().query.memberships.findFirst({
    where: and(
      eq(schema.memberships.userId, userId),
      eq(schema.memberships.workspaceId, workspaceId)
    ),
  });
}

async function ownerCount(workspaceId: string): Promise<number> {
  const [row] = await db()
    .select({ count: count() })
    .from(schema.memberships)
    .where(
      and(
        eq(schema.memberships.workspaceId, workspaceId),
        eq(schema.memberships.role, "owner")
      )
    );
  return row.count;
}

/** Change a member's role. Admin+; only owners may grant/revoke owner. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAuth("admin");
  if (auth instanceof Response) return auth;
  const { userId } = await params;

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid role" }, { status: 400 });
  }
  const newRole = parsed.data.role;

  const target = await membershipOf(userId, auth.workspaceId);
  if (!target) return Response.json({ error: "not a member" }, { status: 404 });

  const touchesOwner = target.role === "owner" || newRole === "owner";
  if (touchesOwner && auth.role !== "owner") {
    return Response.json(
      { error: "only an owner can grant or revoke ownership" },
      { status: 403 }
    );
  }
  if (
    target.role === "owner" &&
    newRole !== "owner" &&
    (await ownerCount(auth.workspaceId)) <= 1
  ) {
    return Response.json(
      { error: "workspace must keep at least one owner" },
      { status: 409 }
    );
  }

  await db()
    .update(schema.memberships)
    .set({ role: newRole })
    .where(eq(schema.memberships.id, target.id));

  await audit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.userId,
    action: "member.role_change",
    targetType: "user",
    targetId: userId,
    meta: { from: target.role, to: newRole },
    ip: clientIp(req),
  });
  return Response.json({ ok: true });
}

/**
 * Remove a member. Admin+ removes others (not owners); any member may
 * remove themself unless they are the last owner.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { userId } = await params;

  const removingSelf = userId === auth.userId;
  if (!removingSelf && !["admin", "owner"].includes(auth.role)) {
    return Response.json({ error: "requires admin role" }, { status: 403 });
  }

  const target = await membershipOf(userId, auth.workspaceId);
  if (!target) return Response.json({ error: "not a member" }, { status: 404 });

  if (target.role === "owner") {
    if (!removingSelf) {
      return Response.json(
        { error: "owners cannot be removed — transfer ownership first" },
        { status: 403 }
      );
    }
    if ((await ownerCount(auth.workspaceId)) <= 1) {
      return Response.json(
        { error: "workspace must keep at least one owner" },
        { status: 409 }
      );
    }
  }

  await db().delete(schema.memberships).where(eq(schema.memberships.id, target.id));
  // Invalidate the removed user's sessions that point at this workspace.
  await db()
    .delete(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, userId),
        eq(schema.sessions.workspaceId, auth.workspaceId)
      )
    );

  await audit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.userId,
    action: removingSelf ? "member.leave" : "member.remove",
    targetType: "user",
    targetId: userId,
    meta: { role: target.role },
    ip: clientIp(req),
  });
  return Response.json({ ok: true });
}
