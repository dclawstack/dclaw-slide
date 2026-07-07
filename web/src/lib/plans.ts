import type { Plan } from "@/lib/db/schema";

/**
 * Plan entitlements. Billing (Stripe) flips `workspaces.plan`; enforcement
 * reads only from here so limits stay consistent across the app.
 */
export interface PlanLimits {
  /** Deck generations per calendar month. */
  generationsPerMonth: number;
  /** AI spend ceiling per calendar month (USD). */
  aiBudgetUsdPerMonth: number;
  /** Members (including owner) per workspace. */
  maxMembers: number;
  /** Brand files per workspace. */
  maxBrandFiles: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    generationsPerMonth: 20,
    aiBudgetUsdPerMonth: 5,
    maxMembers: 3,
    maxBrandFiles: 10,
  },
  pro: {
    generationsPerMonth: 300,
    aiBudgetUsdPerMonth: 50,
    maxMembers: 25,
    maxBrandFiles: 200,
  },
  enterprise: {
    generationsPerMonth: 5_000,
    aiBudgetUsdPerMonth: 500,
    maxMembers: 500,
    maxBrandFiles: 5_000,
  },
};

export function limitsFor(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

/** First instant of the current calendar month (UTC). */
export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
