import { db, hasDb, schema } from "@/lib/db";
import { logger, errField } from "@/lib/logger";

export interface AuditEntry {
  workspaceId: string;
  actorUserId?: string | null;
  action: string; // dotted verb, e.g. "deck.create", "member.role_change"
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Append to the workspace audit log. Best-effort by design — an audit
 * failure must not fail the user's action — but always leaves a trace.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  if (!hasDb()) return;
  try {
    await db().insert(schema.auditLog).values({
      workspaceId: entry.workspaceId,
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      meta: entry.meta ?? null,
      ip: entry.ip ?? null,
    });
  } catch (err) {
    logger.error("audit write failed", { action: entry.action, ...errField(err) });
  }
}
