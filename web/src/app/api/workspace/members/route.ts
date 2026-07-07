import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const members = await db()
    .select({
      userId: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.memberships.role,
      joinedAt: schema.memberships.createdAt,
    })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.workspaceId, auth.workspaceId))
    .orderBy(schema.memberships.createdAt);

  return Response.json({ members });
}
