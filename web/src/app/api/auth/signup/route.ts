import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import { hashPassword } from "@/lib/share";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const SignupSchema = z.object({
  email: z.string().email().max(254).transform((e) => e.trim().toLowerCase()),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(10).max(256),
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
  const { email, name, password } = parsed.data;

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

  const [user] = await db()
    .insert(schema.users)
    .values({ email, name, passwordHash: hashPassword(password) })
    .returning({ id: schema.users.id });

  const [workspace] = await db()
    .insert(schema.workspaces)
    .values({ name: `${name}'s workspace` })
    .returning({ id: schema.workspaces.id });

  await db().insert(schema.memberships).values({
    userId: user.id,
    workspaceId: workspace.id,
    role: "owner",
  });

  await createSession(user.id, workspace.id, {
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return Response.json({ ok: true, workspaceId: workspace.id });
}
