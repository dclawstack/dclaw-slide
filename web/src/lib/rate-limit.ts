import type { NextRequest } from "next/server";

/**
 * Fixed-window in-memory rate limiter.
 *
 * Per-instance on serverless, so limits are per warm lambda — a cost/abuse
 * baseline, not a hard global guarantee. Swap `rateLimit` for a Redis-backed
 * implementation (e.g. Upstash Ratelimit) when a shared store is available;
 * call sites stay unchanged.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
  now = Date.now()
): RateLimitResult {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfterSec: 0 };
}

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still full of live buckets (attack or huge fleet): drop oldest entries.
  if (buckets.size >= MAX_BUCKETS) {
    for (const key of buckets.keys()) {
      if (buckets.size < MAX_BUCKETS / 2) break;
      buckets.delete(key);
    }
  }
}

/** First hop of x-forwarded-for — set by Vercel/most proxies. */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** 429 response with Retry-After. */
export function tooManyRequests(result: RateLimitResult): Response {
  return Response.json(
    { error: "rate limit exceeded, slow down" },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, result.retryAfterSec)) },
    }
  );
}

/** Convenience guard: returns a 429 Response to send, or null to proceed. */
export function checkRateLimit(
  req: NextRequest,
  name: string,
  opts: { limit: number; windowMs: number }
): Response | null {
  const result = rateLimit(`${name}:${clientIp(req)}`, opts);
  return result.ok ? null : tooManyRequests(result);
}
