import { describe, expect, it } from "vitest";
import { limitsFor, monthStart, PLAN_LIMITS } from "./plans";

describe("plans", () => {
  it("every plan defines all limits as positive numbers", () => {
    for (const limits of Object.values(PLAN_LIMITS)) {
      expect(limits.generationsPerMonth).toBeGreaterThan(0);
      expect(limits.aiBudgetUsdPerMonth).toBeGreaterThan(0);
      expect(limits.maxMembers).toBeGreaterThan(0);
      expect(limits.maxBrandFiles).toBeGreaterThan(0);
    }
  });

  it("plans are strictly increasing free < pro < enterprise", () => {
    const keys = [
      "generationsPerMonth",
      "aiBudgetUsdPerMonth",
      "maxMembers",
      "maxBrandFiles",
    ] as const;
    for (const key of keys) {
      expect(PLAN_LIMITS.free[key]).toBeLessThan(PLAN_LIMITS.pro[key]);
      expect(PLAN_LIMITS.pro[key]).toBeLessThan(PLAN_LIMITS.enterprise[key]);
    }
  });

  it("limitsFor falls back to free for unknown plans", () => {
    expect(limitsFor("weird" as never)).toEqual(PLAN_LIMITS.free);
  });

  it("monthStart returns the first UTC instant of the month", () => {
    const d = monthStart(new Date("2026-07-19T15:30:00Z"));
    expect(d.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});
