// Demo seed/clear endpoint. Part of the removable demo module (see src/demo/seed.ts).
import { NextRequest } from "next/server";
import { seedDemo, clearDemo, demoStatus } from "@/demo/seed";
import { getAuth, requireAuth } from "@/lib/auth/session";
import { hasDb } from "@/lib/db";

export const maxDuration = 60;

export async function GET() {
  if (!hasDb()) return Response.json({ seeded: false, decks: 0, db: false });
  const auth = await getAuth();
  if (!auth) return Response.json({ seeded: false, decks: 0, auth: false });
  return Response.json(await demoStatus(auth.workspaceId));
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth("admin");
  if (auth instanceof Response) return auth;
  const { action } = await req.json().catch(() => ({ action: "" }));
  if (action === "seed") return Response.json(await seedDemo(auth.workspaceId));
  if (action === "clear") {
    await clearDemo(auth.workspaceId);
    return Response.json(await demoStatus(auth.workspaceId));
  }
  return Response.json({ error: "action must be 'seed' or 'clear'" }, { status: 400 });
}
