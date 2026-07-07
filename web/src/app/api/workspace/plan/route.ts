import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { PLANS } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

const PlanSchema = z.object({ plan: z.enum(PLANS) });

/**
 * Change the workspace plan. Owner only.
 *
 * NOTE: in production this must be driven by the billing provider
 * (Stripe checkout + webhook flips the plan), not called directly by
 * clients. Until Stripe keys are configured this endpoint is the manual
 * upgrade path; it is owner-gated and fully audited.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth("owner");
  if (auth instanceof Response) return auth;

  const parsed = PlanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid plan" }, { status: 400 });
  }

  const [row] = await db()
    .update(schema.workspaces)
    .set({ plan: parsed.data.plan })
    .where(eq(schema.workspaces.id, auth.workspaceId))
    .returning({ plan: schema.workspaces.plan });

  await audit({
    workspaceId: auth.workspaceId,
    actorUserId: auth.userId,
    action: "workspace.plan_change",
    meta: { to: parsed.data.plan },
    ip: clientIp(req),
  });
  return Response.json({ ok: true, plan: row.plan });
}
