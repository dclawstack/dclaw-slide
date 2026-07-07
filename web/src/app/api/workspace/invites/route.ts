import { NextRequest } from "next/server";
import { z } from "zod";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { limitsFor } from "@/lib/plans";

const CreateSchema = z.object({
  role: z.enum(["viewer", "editor", "admin"]).default("editor"),
  email: z
    .string()
    .email()
    .max(254)
    .transform((e) => e.trim().toLowerCase())
    .optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export async function GET() {
  const auth = await requireAuth("admin");
  if (auth instanceof Response) return auth;
  const invitesList = await db()
    .select({
      id: schema.invites.id,
      token: schema.invites.token,
      role: schema.invites.role,
      email: schema.invites.email,
      expiresAt: schema.invites.expiresAt,
      acceptedAt: schema.invites.acceptedAt,
      createdAt: schema.invites.createdAt,
    })
    .from(schema.invites)
    .where(
      and(
        eq(schema.invites.workspaceId, auth.workspaceId),
        isNull(schema.invites.acceptedAt)
      )
    )
    .orderBy(desc(schema.invites.createdAt))
    .limit(50);
  return Response.json({ invites: invitesList });
}

/** Create an invite link. Admin+. Ownership is never grantable by invite. */
export async function POST(req: NextRequest) {
  const auth = await requireAuth("admin");
  if (auth instanceof Response) return auth;

  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid invite", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Seat limit: members + open invites must stay within the plan.
  const workspace = await db().query.workspaces.findFirst({
    where: eq(schema.workspaces.id, auth.workspaceId),
  });
  const [members] = await db()
    .select({ count: count() })
    .from(schema.memberships)
    .where(eq(schema.memberships.workspaceId, auth.workspaceId));
  const [open] = await db()
    .select({ count: count() })
    .from(schema.invites)
    .where(
      and(
        eq(schema.invites.workspaceId, auth.workspaceId),
        isNull(schema.invites.acceptedAt)
      )
    );
  const limits = limitsFor(workspace?.plan ?? "free");
  if (members.count + open.count >= limits.maxMembers) {
    return Response.json(
      { error: `plan allows ${limits.maxMembers} members — upgrade to add more` },
      { status: 402 }
    );
  }

  const token = nanoid(28);
  await db()
    .insert(schema.invites)
    .values({
      workspaceId: auth.workspaceId,
      token,
      role: parsed.data.role,
      email: parsed.data.email ?? null,
      createdBy: auth.userId,
      expiresAt: new Date(Date.now() + parsed.data.expiresInDays * 86_400_000),
    });

  await audit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.userId,
    action: "invite.create",
    targetType: "invite",
    targetId: token,
    meta: { role: parsed.data.role, email: parsed.data.email ?? null },
    ip: clientIp(req),
  });
  return Response.json({ url: `/invite/${token}`, token });
}
