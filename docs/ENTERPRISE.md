# DClaw Slide — Enterprise Operations Runbook

Last updated: 2026-07-07 (enterprise hardening, Phases 0–3).

## What is enforced in code today

| Pillar | Status |
|--------|--------|
| Authentication | Email/password, scrypt-hashed; DB-backed revocable sessions (30d); opaque cookie tokens (sha256 server-side) |
| Multi-tenancy | Every deck/file/chunk/event query scoped to the session workspace; cross-tenant reads return 404 |
| RBAC | viewer < editor < admin < owner, enforced server-side via `requireAuth(minRole)` |
| Audit log | Append-only `audit_log` (actor, action, target, meta, IP) on every mutation; CSV export at `/api/workspace/audit?format=csv` |
| Invites & members | Role-scoped expiring invite links (optionally email-locked); owner-safety rules; removed members' sessions revoked |
| Data controls | Workspace JSON export, owner-only workspace delete, deck delete, share-link expiry + password (scrypt) |
| Rate limiting | Fixed-window per-IP on generation, ingest, auth, share-password, invite lookups |
| Plan limits | Monthly generations, AI budget (USD), members, brand files — enforced before spend; metered in `usage_events` |
| Observability | Structured JSON logs (`lib/logger.ts`), `onRequestError` hook, `/api/health` (DB + AI dependency status) |
| AI reliability | Header-timeout + one retry with backoff on 408/429/5xx/network; multi-model consensus with graceful single-model fallback |
| Security headers | nosniff, SAMEORIGIN, HSTS, referrer-policy, permissions-policy |

## Human-only checklist (cannot be done from code)

1. **Rotate the OpenRouter API key.** The old key appeared in
   `BUILD-INPUTS.md` / `.env.local` / `.openrouter.key` and in chat
   transcripts — treat it as burned. Create a new key at
   https://openrouter.ai/settings/keys (set a spend limit), update the
   Vercel env var, delete `.openrouter.key`.
2. **Vercel env vars**: production already has `DATABASE_URL` (Neon-Vercel
   integration) and `OPENROUTER_API_KEY` — replace the latter with the
   rotated key. Auth activates automatically because the DB is configured.
3. **Push & deploy**: main (local) already contains the merge; review and
   `git push`. Migrations 0002/0003 apply at build via
   `scripts/db-setup.mjs`.
4. **Claim the pre-auth decks.** Decks generated before auth live in the
   legacy `default` workspace, which no user owns. After signing up in
   production, attach yourself to it (Neon SQL console):

   ```sql
   INSERT INTO memberships (user_id, workspace_id, role)
   SELECT u.id, w.id, 'owner'
   FROM users u, workspaces w
   WHERE u.email = 'tharunidayara@gmail.com' AND w.name = 'default';
   ```

   Then switch to it in Settings → Workspace (the switcher appears once
   you belong to more than one workspace).
5. **Neon backups**: enable point-in-time restore on the Neon project and
   do one test restore to a branch. Document your RPO/RTO.
6. **Stripe** (when billing goes live): create products for `pro` /
   `enterprise`, wire checkout + a webhook that calls the plan change
   path (`workspaces.plan`); then restrict `/api/workspace/plan` to the
   webhook. Until then it is owner-gated and audited.
7. **SSO/SAML/SCIM** (when an enterprise customer asks): front the
   credentials login with WorkOS or Clerk; the session layer
   (`lib/auth/session.ts`) is provider-agnostic — swap `createSession`
   callers only.
8. **Error tracking vendor** (optional): add `@sentry/nextjs`, initialize
   in `src/instrumentation.ts` `register()` behind `SENTRY_DSN`.
9. **Rate limiting at scale**: current limiter is per-instance; when
   traffic justifies it, swap `lib/rate-limit.ts` internals for Upstash
   Ratelimit (call sites unchanged) or enable Vercel WAF rules.

## Operational endpoints

- `GET /api/health` — liveness + dependency status (unauthenticated, no data).
- `GET /api/workspace/audit?format=csv` — audit trail (admin+).
- `GET /api/workspace/export` — full workspace data export (admin+).

## Incident basics

- Logs are single-line JSON on stdout/stderr — filter by `level`, `msg`,
  `path` in the Vercel dashboard.
- Kill a leaked session: delete its row in `sessions` (or the user's rows)
  — takes effect on the next request.
- Disable AI spend instantly: remove `OPENROUTER_API_KEY` in Vercel env and
  redeploy; generation falls back to demo streaming.
- GDPR delete request: workspace owner uses Settings → Danger zone, or run
  `DELETE FROM workspaces WHERE id = …` (cascades everywhere).

## Compliance groundwork

SOC 2 Type I evidence now available from the app: RBAC matrix (this doc +
`lib/auth/session.ts`), audit trail, session revocation, tenant isolation,
plan-limited spend. Still needed org-side: access reviews, vendor list
(Neon, Vercel, OpenRouter), incident-response policy, backup evidence
(item 4). For GDPR: export/delete flows exist; add a DPA with the model
provider — OpenRouter routes to multiple upstream providers, so enterprise
customers should get the model allow-list documented (`lib/ai/models.ts`).
