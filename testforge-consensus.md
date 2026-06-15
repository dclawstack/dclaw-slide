# TestForge Consensus — dclaw-slide

**Models:** anthropic/claude-opus-4.8 (A) vs anthropic/claude-sonnet-4.6 (B)
**Path:** `/Users/rp/Documents/Tharuni WN/dclaw-slide`

A bug is CONFIRMED only when BOTH models' generated tests FAIL (both reproduce it).

| Finding | File:line | Severity | Opus-4.8 | Sonnet-4.6 | Verdict |
|---------|-----------|----------|----------|------------|---------|
| Missing Rate Limiting | `package.json:1` | medium | PASS (2✓) | PASS (4✓) | 🟢 NOT REPRODUCED |

## Generated tests

### Missing Rate Limiting — verdict: 🟢 NOT REPRODUCED

**Opus-4.8** (`security-package-l1.test.ts`, PASS (2✓)):

```ts
import { describe, it, expect } from "vitest";

// Synthetic auth endpoint guarded (or not) by a simple fixed-window rate limiter.
type Attempt = { ok: boolean; status: number };

function makeHandler() {
  // Always "succeeds" reaching the auth logic regardless of request volume.
  return (): Attempt => ({ ok: true, status: 200 });
}

// A minimal in-memory fixed-window limiter (no timers, deterministic).
function makeRateLimitedHandler(max: number) {
  let count = 0;
  return (): Attempt => {
    count += 1;
    if (count > max) return { ok: false, status: 429 };
    return { ok: true, status: 200 };
  };
}

describe("missing rate limiting on auth endpoint", () => {
  it("foot-gun: unlimited login attempts all succeed (brute-force enabled)", () => {
    const handler = makeHandler();
    const results: Attempt[] = [];
    for (let i = 0; i < 1000; i++) results.push(handler());

    const blocked = results.filter((r) => r.status === 429).length;
    // Nothing is ever throttled — a brute-force attacker is unimpeded.
    expect(blocked).toBe(0);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("safe fix: rate limiter blocks excess attempts with 429", () => {
    const max = 5;
    const handler = makeRateLimitedHandler(max);
    const results: Attempt[] = [];
    for (let i = 0; i < 1000; i++) results.push(handler());

    const allowed = results.filter((r) => r.status === 200).length;
    const blocked = results.filter((r) => r.status === 429).length;

    expect(allowed).toBe(max);
    expect(blocked).toBe(1000 - max);
    expect(results[max].status).toBe(429);
  });
});
```

**Sonnet-4.6** (`security-package-l1.test.ts`, PASS (4✓)):

```ts
import { describe, it, expect } from "vitest";

// Synthetic in-memory rate limiter – mirrors what express-rate-limit does
function createRateLimiter(options: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return function limit(ip: string, now: number): { allowed: boolean; remaining: number; retryAfter?: number } {
    const entry = hits.get(ip);
    if (!entry || now >= entry.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + options.windowMs });
      return { allowed: true, remaining: options.max - 1 };
    }
    if (entry.count >= options.max) {
      return { allowed: false, remaining: 0, retryAfter: entry.resetAt - now };
    }
    entry.count += 1;
    return { allowed: true, remaining: options.max - entry.count };
  };
}

// Simulates an auth handler WITHOUT any rate limiting
function unprotectedAuthHandler(attempts: string[]): { successCount: number } {
  // Every request is processed regardless of volume – the foot-gun
  let successCount = 0;
  for (const _attempt of attempts) {
    // pretend we checked credentials
    successCount += 1;
  }
  return { successCount };
}

// Simulates an auth handler WITH rate limiting applied
function protectedAuthHandler(
  attempts: Array<{ ip: string; ts: number }>,
  limiter: ReturnType<typeof createRateLimiter>
): { allowed: number; blocked: number } {
  let allowed = 0;
  let blocked = 0;
  for (const { ip, ts } of attempts) {
    const result = limiter(ip, ts);
    if (result.allowed) {
      allowed += 1;
    } else {
      blocked += 1;
    }
  }
  return { allowed, blocked };
}

describe("Auth endpoint rate limiting", () => {
  it("demonstrates the foot-gun: without rate limiting, all brute-force attempts are processed", () => {
    // Simulate 200 rapid login attempts from the same attacker
    const bruteForceAttempts = Array.from({ length: 200 }, (_, i) => `attempt-${i}`);

    const result = unprotectedAuthHandler(bruteForceAttempts);

    // Every single attempt goes through – no protection at all
    expect(result.successCount).toBe(200);
    // This is the danger: an attacker can try thousands of passwords unchecked
  });

  it("safe fix: rate limiter allows only max requests per window and blocks the rest", () => {
    const WINDOW_MS = 60_000; // 1 minute
    const MAX_REQUESTS = 5;   // only 5 login attempts per IP per minute

    const limiter = createRateLimiter({ windowMs: WINDOW_MS, max: MAX_REQUESTS });

    // 20 rapid attempts from the same IP within the same window (ts = 0)
    const attempts = Array.from({ length: 20 }, () => ({ ip: "192.168.1.1", ts: 0 }));

    const { allowed, blocked } = protectedAuthHandler(attempts, limiter);

    expect(allowed).toBe(MAX_REQUESTS);          // only 5 get through
    expect(blocked).toBe(20 - MAX_REQUESTS);     // remaining 15 are blocked
  });

  it("safe fix: rate limit resets after the window expires, allowing legitimate users back in", () => {
    const WINDOW_MS = 60_000;
    const MAX_REQUESTS = 3;

    const limiter = createRateLimiter({ windowMs: WINDOW_MS, max: MAX_REQUESTS });
    const ip = "10.0.0.1";

    // Exhaust the limit in window 1 (ts = 0)
    const window1 = Array.from({ length: 5 }, () => ({ ip, ts: 0 }));
    const result1 = protectedAuthHandler(window1, limiter);
    expect(result1.allowed).toBe(MAX_REQUESTS);
    expect(result1.blocked).toBe(2);

    // After the window resets (ts = WINDOW_MS), the same IP can make requests again
    const window2 = Array.from({ length: 3 }, () => ({ ip, ts: WINDOW_MS }));
    const result2 = protectedAuthHandler(window2, limiter);
    expect(result2.allowed).toBe(MAX_REQUESTS);  // fresh window – all 3 allowed
    expect(result2.blocked).toBe(0);
  });

  it("safe fix: different IPs have independent rate-limit buckets", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });

    const attempts = [
      { ip: "1.1.1.1", ts: 0 },
      { ip: "1.1.1.1", ts: 0 },
      { ip: "1.1.1.1", ts: 0 }, // 3rd from same IP – should be blocked
      { ip: "2.2.2.2", ts: 0 }, // different IP – should be allowed
      { ip: "2.2.2.2", ts: 0 }, // 2nd from 2.2.2.2 – allowed
    ];

    const { allowed, blocked } = protectedAuthHandler(attempts, limiter);

    expect(allowed).toBe(4); // 2 from 1.1.1.1 + 2 from 2.2.2.2
    expect(blocked).toBe(1); // 3rd attempt from 1.1.1.1
  });
});
```

