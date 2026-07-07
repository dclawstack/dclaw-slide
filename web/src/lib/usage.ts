import { and, count, eq, gte, sql } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import { limitsFor, monthStart, type PlanLimits } from "@/lib/plans";
import type { GenerationMeta } from "@/lib/ai/generate";

export interface MonthlyUsage {
  generations: number;
  costUsd: number;
}

export async function monthlyUsage(workspaceId: string): Promise<MonthlyUsage> {
  const [row] = await db()
    .select({
      generations: count(),
      costUsd: sql<string>`coalesce(sum(${schema.usageEvents.costUsd}), 0)`,
    })
    .from(schema.usageEvents)
    .where(
      and(
        eq(schema.usageEvents.workspaceId, workspaceId),
        eq(schema.usageEvents.kind, "generation"),
        gte(schema.usageEvents.ts, monthStart())
      )
    );
  return { generations: row.generations, costUsd: Number(row.costUsd) };
}

/**
 * Plan gate for a new generation. Returns null to proceed, or a 402
 * Response describing which limit was hit.
 */
export async function checkGenerationAllowance(
  workspaceId: string
): Promise<Response | null> {
  const workspace = await db().query.workspaces.findFirst({
    where: eq(schema.workspaces.id, workspaceId),
    columns: { plan: true },
  });
  const limits: PlanLimits = limitsFor(workspace?.plan ?? "free");
  const usage = await monthlyUsage(workspaceId);

  if (usage.generations >= limits.generationsPerMonth) {
    return Response.json(
      {
        error: `monthly generation limit reached (${limits.generationsPerMonth} on the ${workspace?.plan ?? "free"} plan)`,
        limit: "generationsPerMonth",
      },
      { status: 402 }
    );
  }
  if (usage.costUsd >= limits.aiBudgetUsdPerMonth) {
    return Response.json(
      {
        error: `monthly AI budget reached ($${limits.aiBudgetUsdPerMonth} on the ${workspace?.plan ?? "free"} plan)`,
        limit: "aiBudgetUsdPerMonth",
      },
      { status: 402 }
    );
  }
  return null;
}

/** Persist one generation's tokens + cost from the pipeline meta. */
export async function recordGeneration(
  workspaceId: string,
  deckId: string | null,
  meta: GenerationMeta
): Promise<void> {
  if (!hasDb()) return;
  let tokens = 0;
  let cost = 0;
  for (const u of Object.values(meta.usage)) {
    tokens += (u.promptTokens ?? 0) + (u.completionTokens ?? 0);
    cost += u.cost ?? 0;
  }
  try {
    await db().insert(schema.usageEvents).values({
      workspaceId,
      kind: "generation",
      tokens,
      costUsd: cost.toFixed(6),
      deckId,
      meta: { models: meta.models, durationMs: meta.durationMs },
    });
  } catch (err) {
    console.error("[usage] record failed:", err);
  }
}
