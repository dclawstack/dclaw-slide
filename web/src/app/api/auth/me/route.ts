import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getAuth } from "@/lib/auth/session";

export async function GET() {
  const auth = await getAuth();
  if (!auth) return Response.json({ user: null }, { status: 401 });

  const workspaces = await db()
    .select({
      id: schema.workspaces.id,
      name: schema.workspaces.name,
      role: schema.memberships.role,
    })
    .from(schema.memberships)
    .innerJoin(
      schema.workspaces,
      eq(schema.workspaces.id, schema.memberships.workspaceId)
    )
    .where(eq(schema.memberships.userId, auth.userId));

  return Response.json({
    user: { id: auth.userId, email: auth.email, name: auth.name },
    workspace: { id: auth.workspaceId, role: auth.role },
    workspaces,
  });
}
