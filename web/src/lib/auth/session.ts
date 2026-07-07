import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import type { Role } from "@/lib/db/schema";

export const SESSION_COOKIE = "ds_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AuthContext {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  workspaceId: string;
  role: Role;
}

const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export function roleAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a DB session and set the cookie. Returns the auth context. */
export async function createSession(
  userId: string,
  workspaceId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {}
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await db()
    .insert(schema.sessions)
    .values({
      tokenHash: hashToken(token),
      userId,
      workspaceId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

/** Revoke the current session (if any) and clear the cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token && hasDb()) {
    await db()
      .delete(schema.sessions)
      .where(eq(schema.sessions.tokenHash, hashToken(token)))
      .catch(() => {});
  }
  jar.delete(SESSION_COOKIE);
}

/**
 * Resolve the current request's auth context, or null.
 * Null when: no cookie, unknown/expired session, or no DB configured.
 */
export async function getAuth(): Promise<AuthContext | null> {
  if (!hasDb()) return null;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db()
    .select({
      sessionId: schema.sessions.id,
      expiresAt: schema.sessions.expiresAt,
      workspaceId: schema.sessions.workspaceId,
      userId: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.memberships.role,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .innerJoin(
      schema.memberships,
      and(
        eq(schema.memberships.userId, schema.sessions.userId),
        eq(schema.memberships.workspaceId, schema.sessions.workspaceId)
      )
    )
    .where(eq(schema.sessions.tokenHash, hashToken(token)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db()
      .delete(schema.sessions)
      .where(eq(schema.sessions.id, row.sessionId))
      .catch(() => {});
    return null;
  }
  return {
    sessionId: row.sessionId,
    userId: row.userId,
    email: row.email,
    name: row.name,
    workspaceId: row.workspaceId,
    role: row.role,
  };
}

/**
 * Route-handler guard. Returns the auth context, or a Response to send
 * (401 unauthenticated / 403 insufficient role / 503 no database).
 *
 *   const auth = await requireAuth("editor");
 *   if (auth instanceof Response) return auth;
 */
export async function requireAuth(
  minRole: Role = "viewer"
): Promise<AuthContext | Response> {
  if (!hasDb()) {
    return Response.json({ error: "no database configured" }, { status: 503 });
  }
  const auth = await getAuth();
  if (!auth) {
    return Response.json({ error: "authentication required" }, { status: 401 });
  }
  if (!roleAtLeast(auth.role, minRole)) {
    return Response.json(
      { error: `requires ${minRole} role` },
      { status: 403 }
    );
  }
  return auth;
}
