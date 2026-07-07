# DClaw Slide

AI-generated presentations locked to your brand. Prompt or ingest your past
decks → brand RAG → multi-model consensus generation → streamed deck →
share/export.

## Repository layout

| Path | What it is |
|------|-----------|
| `web/` | **The app.** Next.js 16 full-stack (App Router), Neon Postgres + Drizzle, OpenRouter AI pipeline. Deployed to Vercel. |
| `.github/workflows/ci.yml` | Lint + typecheck + unit tests + build for `web/` on every push/PR to main. |
| `docs/`, `*.md` | Product and planning documents. |

The original FastAPI + Next.js scaffold (`backend/`, `frontend/`, `helm/`,
`docker-compose.yml`) was retired when the app was rebuilt as a single
Next.js full-stack app (`BUILD_STRATEGY=rewrite`). It is preserved on the
`legacy-fastapi-stack` branch.

## Development

```bash
cd web
bun install
bun run dev        # http://localhost:3000
bun run test       # vitest unit tests
bun run typecheck
bun run lint
```

Without `DATABASE_URL` the app runs in keyless demo mode (no auth, canned
deck streaming). With a database configured, all app pages and APIs require
a signed-in user and every query is scoped to the user's workspace.

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string (enables auth + persistence) |
| `OPENROUTER_API_KEY` | AI generation (consensus pipeline) |

See `web/.env.example` and `docs/ENTERPRISE.md` for the full operational
runbook.

## Code Manager

| Name | Email |
|------|-------|
| Tharuni Dayara | tharunidayara@gmail.com |
