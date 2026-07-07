import { logger } from "@/lib/logger";

export function register() {
  // Sentry (or another APM) initializes here once a DSN is configured:
  //   if (process.env.SENTRY_DSN) { await import("./sentry.server.config") }
}

/** Next.js server-error hook — every unhandled route error gets one line. */
export function onRequestError(
  err: unknown,
  request: { path: string; method: string }
) {
  logger.error("unhandled request error", {
    path: request.path,
    method: request.method,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
}
