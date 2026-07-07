import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import { verifyPassword } from "@/lib/share";
import { createSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const LoginSchema = z.object({
  email: z.string().email().max(254).transform((e) => e.trim().toLowerCase()),
  password: z.string().min(1).max(256),
});

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, "login", {
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if (limited) return limited;
  if (!hasDb()) {
    return Response.json({ error: "no database configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid credentials" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await db().query.users.findFirst({
    where: eq(schema.users.email, email),
  });
  // Same response for unknown email and wrong password.
  if (!user || !verifyPassword(user.passwordHash, password)) {
    return Response.json({ error: "invalid email or password" }, { status: 401 });
  }

  const membership = await db().query.memberships.findFirst({
    where: eq(schema.memberships.userId, user.id),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  });
  if (!membership) {
    return Response.json({ error: "no workspace for this user" }, { status: 403 });
  }

  await createSession(user.id, membership.workspaceId, {
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  await audit({
    workspaceId: membership.workspaceId,
    actorUserId: user.id,
    action: "auth.login",
    ip: clientIp(req),
  });

  return Response.json({ ok: true, workspaceId: membership.workspaceId });
}
