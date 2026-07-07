import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

const WINDOW = { limit: 3, windowMs: 60_000 };

describe("rateLimit", () => {
  it("allows up to the limit within a window", () => {
    const t0 = 1_000_000;
    expect(rateLimit("a", WINDOW, t0).ok).toBe(true);
    expect(rateLimit("a", WINDOW, t0 + 1).ok).toBe(true);
    expect(rateLimit("a", WINDOW, t0 + 2).ok).toBe(true);
    expect(rateLimit("a", WINDOW, t0 + 3).ok).toBe(false);
  });

  it("reports retry-after seconds when limited", () => {
    const t0 = 2_000_000;
    for (let i = 0; i < 3; i++) rateLimit("b", WINDOW, t0);
    const result = rateLimit("b", WINDOW, t0 + 30_000);
    expect(result.ok).toBe(false);
    expect(result.retryAfterSec).toBe(30);
  });

  it("resets after the window elapses", () => {
    const t0 = 3_000_000;
    for (let i = 0; i < 4; i++) rateLimit("c", WINDOW, t0);
    expect(rateLimit("c", WINDOW, t0 + 60_001).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    const t0 = 4_000_000;
    for (let i = 0; i < 4; i++) rateLimit("d", WINDOW, t0);
    expect(rateLimit("e", WINDOW, t0).ok).toBe(true);
  });

  it("counts remaining correctly", () => {
    const t0 = 5_000_000;
    expect(rateLimit("f", WINDOW, t0).remaining).toBe(2);
    expect(rateLimit("f", WINDOW, t0).remaining).toBe(1);
    expect(rateLimit("f", WINDOW, t0).remaining).toBe(0);
  });
});
