import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import { hashPassword } from "@/lib/share";
import { createSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const SignupSchema = z.object({
  email: z.string().email().max(254).transform((e) => e.trim().toLowerCase()),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(10).max(256),
  inviteToken: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, "signup", {
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (limited) return limited;
  if (!hasDb()) {
    return Response.json({ error: "no database configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid signup", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { email, name, password, inviteToken } = parsed.data;

  const existing = await db().query.users.findFirst({
    where: eq(schema.users.email, email),
    columns: { id: true },
  });
  if (existing) {
    return Response.json(
      { error: "an account with this email already exists" },
      { status: 409 }
    );
  }

  // Joining via invite lands in the inviter's workspace with the invited
  // role; otherwise the user gets a personal workspace as owner.
  let invite = null;
  if (inviteToken) {
    invite = await db().query.invites.findFirst({
      where: and(
        eq(schema.invites.token, inviteToken),
        isNull(schema.invites.acceptedAt)
      ),
    });
    if (!invite || invite.expiresAt.getTime() < Date.now()) {
      return Response.json(
        { error: "invite not found or expired" },
        { status: 404 }
      );
    }
    if (invite.email && invite.email !== email) {
      return Response.json(
        { error: "this invite is for a different email address" },
        { status: 403 }
      );
    }
  }

  const [user] = await db()
    .insert(schema.users)
    .values({ email, name, passwordHash: hashPassword(password) })
    .returning({ id: schema.users.id });

  let workspaceId: string;
  let role: "owner" | typeof schema.ROLES[number];
  if (invite) {
    workspaceId = invite.workspaceId;
    role = invite.role;
    await db().insert(schema.memberships).values({
      userId: user.id,
      workspaceId,
      role,
    });
    await db()
      .update(schema.invites)
      .set({ acceptedBy: user.id, acceptedAt: new Date() })
      .where(eq(schema.invites.id, invite.id));
  } else {
    const [workspace] = await db()
      .insert(schema.workspaces)
      .values({ name: `${name}'s workspace` })
      .returning({ id: schema.workspaces.id });
    workspaceId = workspace.id;
    role = "owner";
    await db().insert(schema.memberships).values({
      userId: user.id,
      workspaceId,
      role: "owner",
    });
  }

  await createSession(user.id, workspaceId, {
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  await audit({
    workspaceId,
    actorUserId: user.id,
    action: invite ? "member.join" : "auth.signup",
    targetType: "user",
    targetId: user.id,
    meta: invite ? { via: "invite", role } : undefined,
    ip: clientIp(req),
  });

  return Response.json({ ok: true, workspaceId });
}
