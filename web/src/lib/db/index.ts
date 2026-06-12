import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Lazy singleton so the app builds and serves marketing pages
 * even before DATABASE_URL is configured.
 */
export function db() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — Neon project not wired yet");
  }
  if (!_db) {
    _db = drizzle(neon(process.env.DATABASE_URL), { schema });
  }
  return _db;
}

export { schema };
