import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";

const MAX_ROWS = 1_000;

function toCsv(rows: Record<string, unknown>[]): string {
  const cols = ["ts", "action", "actorUserId", "targetType", "targetId", "ip", "meta"];
  const escape = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => escape(r[c])).join(",")),
  ].join("\n");
}

/** Workspace audit trail, newest first. Admin+. ?format=csv for export. */
export async function GET(req: NextRequest) {
  const auth = await requireAuth("admin");
  if (auth instanceof Response) return auth;

  const rows = await db()
    .select({
      ts: schema.auditLog.ts,
      action: schema.auditLog.action,
      actorUserId: schema.auditLog.actorUserId,
      targetType: schema.auditLog.targetType,
      targetId: schema.auditLog.targetId,
      ip: schema.auditLog.ip,
      meta: schema.auditLog.meta,
    })
    .from(schema.auditLog)
    .where(eq(schema.auditLog.workspaceId, auth.workspaceId))
    .orderBy(desc(schema.auditLog.ts))
    .limit(MAX_ROWS);

  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="audit-log.csv"',
      },
    });
  }
  return Response.json({ entries: rows, truncatedAt: MAX_ROWS });
}
