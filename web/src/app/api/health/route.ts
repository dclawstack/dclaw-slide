import { sql } from "drizzle-orm";
import { db, hasDb } from "@/lib/db";
import { hasOpenRouter } from "@/lib/ai/openrouter";

export const dynamic = "force-dynamic";

/** Liveness + dependency health. Unauthenticated by design (no data). */
export async function GET() {
  let database: "up" | "down" | "unconfigured" = "unconfigured";
  if (hasDb()) {
    try {
      await db().execute(sql`SELECT 1`);
      database = "up";
    } catch {
      database = "down";
    }
  }
  const ok = database !== "down";
  return Response.json(
    {
      ok,
      database,
      ai: hasOpenRouter() ? "configured" : "unconfigured",
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      ts: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
