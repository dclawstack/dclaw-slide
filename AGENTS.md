# DClaw Slide — Agent Development Guide

> Read this before making code changes. The app lives in `web/` —
> a single Next.js 16 full-stack application. The old FastAPI stack is
> archived on the `legacy-fastapi-stack` branch; do not resurrect it.

## Architecture

- **Next.js 16 App Router** (`web/src/app/`) — pages and API route handlers.
  Note: Next 16 renamed `middleware.ts` to `proxy.ts` (see `web/src/proxy.ts`)
  and the bundled docs in `web/node_modules/next/dist/docs/` are authoritative.
- **Neon Postgres + Drizzle** (`web/src/lib/db/`) — schema in `schema.ts`,
  migrations generated with `npx drizzle-kit generate`, applied at build time
  by `scripts/db-setup.mjs`.
- **AI pipeline** (`web/src/lib/ai/`) — OpenRouter consensus generation:
  two outliners → judge → streaming designer. Model choices in `models.ts`.
- **Auth** (`web/src/lib/auth/session.ts`) — DB-backed sessions, opaque
  cookie token (sha256 stored), scrypt passwords. Roles:
  viewer < editor < admin < owner.

## Non-negotiable rules

1. **Every workspace-owned query is scoped.** Any query touching decks,
   ingested files, brand chunks, or events must filter by the session's
   `workspaceId`. Use `requireAuth(minRole)` in every API route that touches
   data; public exceptions are the share-token routes only.
2. **No raw SQL string interpolation.** Use drizzle's `sql` template
   parameters (see `web/src/lib/rag.ts`).
3. **Rate-limit cost-bearing and abuse-prone endpoints** with
   `checkRateLimit()` (generation, ingest, auth, share-password attempts).
4. **New tables need a drizzle migration** in the same commit.
5. **Keyless demo mode must keep working** — every DB/AI code path degrades
   gracefully when `DATABASE_URL` / `OPENROUTER_API_KEY` are absent.
6. **Secrets never enter git.** `.env.local`, `BUILD-INPUTS.md`, and
   `.openrouter.key` are gitignored; keep it that way.

## How to add a feature

1. Schema change in `web/src/lib/db/schema.ts` → `npx drizzle-kit generate`.
2. API route under `web/src/app/api/` — `requireAuth()` first, zod-validate
   the body, scope every query, audit-log mutations.
3. UI under `web/src/app/` using existing Tailwind patterns.
4. Unit tests for new pure logic (`*.test.ts` next to the module).
5. `bun run lint && bun run typecheck && bun run test && bun run build`
   must pass — CI runs exactly these.

## Testing

- Vitest, DB-free unit tests (`web/vitest.config.ts`, `src/**/*.test.ts`).
- No mocked in-memory "databases" pretending to be integration tests; test
  pure logic directly and keep API handlers thin.
