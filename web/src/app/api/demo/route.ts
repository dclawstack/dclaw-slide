// Demo seed/clear endpoint. Part of the removable demo module (see src/demo/seed.ts).
import { NextRequest } from "next/server";
import { seedDemo, clearDemo, demoStatus } from "@/demo/seed";

export const maxDuration = 60;

export async function GET() {
  return Response.json(await demoStatus());
}

export async function POST(req: NextRequest) {
  const { action } = await req.json().catch(() => ({ action: "" }));
  if (action === "seed") return Response.json(await seedDemo());
  if (action === "clear") {
    await clearDemo();
    return Response.json(await demoStatus());
  }
  return Response.json({ error: "action must be 'seed' or 'clear'" }, { status: 400 });
}
