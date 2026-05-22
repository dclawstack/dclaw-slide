# DClaw Slide — v1.2 Feature Roadmap

> 📘 **REVISED PRD v2.3** is the product spec (`REVISED-PRD.md`).
> 📘 **AGENTS.md** is the architecture lock — ports `8021` / `3021`, DB `dclaw_slide`, FastAPI + Next.js + SQLAlchemy 2.0.
>
> This file is the prioritized, complexity-graded delivery plan. Implementation **must** proceed
> bottom-up: every Complexity 0 ticket ships before any Complexity 1 ticket starts.

---

## 0. YC Readiness Snapshot

DClaw Slide enters a crowded category (Gamma, Tome, Beautiful.ai, Pitch). To clear the YC bar
("hair-on-fire problem, defensible wedge, technical depth, scalable architecture"), this plan
positions Slide on **three differentiators** that the incumbents do not own:

| YC criterion | Incumbent baseline | DClaw Slide wedge |
|---|---|---|
| **Hair-on-fire problem** | "Decks take time" (soft) | **Brand drift + stale data + bad pitch delivery** — three concrete pains we measure, not one fuzzy one. |
| **Defensible moat** | Generic LLM-to-slide | **Brand RAG over your past decks** + **multi-agent generator** (outliner → designer → critic) + **live presenter coaching** (filler/pacing) — none shipped by Gamma/Tome. |
| **Technical depth** | One-shot prompt | Multi-agent with critic loop, pgvector brand index, real-time audio analysis, data-bound slides, Temporal-orchestrated long jobs. |
| **Scalability** | Single-tenant SaaS | Multi-tenant from day one (workspace_id on every row), async job queue for slow generations, usage metering hook for Stripe. |
| **Demo punch** | "Watch a deck appear" | "Watch a deck appear that **looks like ours**, with **live data**, and grades my **rehearsal** in real time." |

**ICP for the YC pitch:** Series-A → Series-C **GTM/consulting/customer-success teams** that need
brand-locked, data-fresh decks weekly, plus founders who rehearse pitches. Concrete enough to
quote a willingness-to-pay; broad enough to scale.

---

## 1. Complexity Grading System

| Tag | Meaning | Definition of Done |
|---|---|---|
| **C0** | **Quick win / foundational.** Pure CRUD, schemas, plumbing, scaffolding. No external services. | Endpoint reachable, persisted, tested, rendered in UI. |
| **C1** | **Core differentiator.** First AI / RAG / collab features; needs Ollama/OpenRouter, pgvector, or websockets. | Feature is demoable end-to-end in dev with a real provider (Ollama OK). |
| **C2** | **Advanced / moat-building.** Multi-agent loops, live audio coaching, data connectors, multi-tenant scale, billing. | Production-grade: observability, retries, billing meter, accessibility pass. |

Rule: **no C1 ticket starts until every C0 ticket in its dependency chain is `merged + tested + verified in browser`.**

---

## 2. Pre-Flight Checklist (must stay green throughout)

- [x] `frontend/package-lock.json` committed after any `npm install`
- [x] `frontend/next-env.d.ts` exists and is committed
- [x] `docker-compose.yml` healthchecks correct, container ports match `EXPOSE`/`ENV PORT` (5432 / 8021 / 3021)
- [x] `frontend/Dockerfile` declares `ARG NEXT_PUBLIC_API_URL` before `RUN npm run build`
- [x] `backend/tests/conftest.py` keeps `localhost:5432` for the CI Postgres service
- [x] `pytest-asyncio==0.24.0` pinned
- [x] Local dev SQLite (`backend/dclaw_slide.db`) is gitignored
- [x] All models inherit `Base` from `app.models.base`
- [x] All routers behind `/api/v1`; health stays at `/health/`
- [x] Repository pattern enforced — no `select(...)` calls in routers (added `ShareLinkRepository` in the audit pass)

---

## 3. Roadmap

### C0 — Foundational (ship now, in order)

| # | Title | Layer | Status | Notes |
|---|---|---|---|---|
| **C0.1** | **SQLite local dev DB + dual-driver config** | Backend | ✅ shipped | `aiosqlite` added; default `DATABASE_URL=sqlite+aiosqlite:///./dclaw_slide.db`; CI stays on Postgres. |
| **C0.2** | **`Presentation` + `Slide` models** | Backend | ✅ shipped | `Uuid` PK, ordered `slides` relationship, `workspace_id` reserved for multi-tenant. |
| **C0.3** | **Repositories + Pydantic v2 schemas** | Backend | ✅ shipped | `PresentationRepository`, `SlideRepository`, `ConfigDict(from_attributes=True)`. |
| **C0.4** | **`/api/v1/presentations` CRUD + nested slides** | Backend | ✅ shipped | Full CRUD; replaced the mock `slide.py`. |
| **C0.5** | **Theme registry** | Backend | ✅ shipped | 5 themes (pitch-classic, pitch-bold, report-minimal, training-warm, dark-investor). |
| **C0.6** | **Markdown-outline parser → slides** | Backend | ✅ shipped | Pure-Python, deterministic; integrated into outline + AI generation paths. |
| **C0.7** | **Slide reorder endpoint** | Backend | ✅ shipped | `POST /api/v1/presentations/{id}/slides/reorder`. |
| **C0.8** | **Dashboard wired to real API** | Frontend | ✅ shipped | `/dashboard` lists + creates presentations. |
| **C0.9** | **Presentation detail + slide viewer/editor** | Frontend | ✅ shipped | Inline edit, **native HTML5 drag-to-reorder**, paste-outline textarea. |
| **C0.10** | **Typed API client + error toasts** | Frontend | ✅ shipped | Toast provider in `components/providers.tsx`; every page surfaces failures via `useToast()`. |
| **C0.11** | **Health + version endpoint** | Backend + Frontend | ✅ shipped | `/health/` returns `{status, app, version, db}`; **footer rendered on every route**. |
| **C0.12** | **Backend tests for C0 surface** | Backend | ✅ shipped | 53 pytest tests green. |
| **C0.13** | **`dclaw-manifest.json`** | Frontend | ✅ shipped | DPanel registration in `frontend/public/`. |
| **C0.14** | **`.gitignore` for local SQLite + `.next/`** | Repo | ✅ shipped | `*.db`, `.next/`, `__pycache__/`, `.venv/` all ignored. |

**C0 demo script:** open `http://localhost:3021/dashboard` → create "Series A Pitch" → paste a markdown outline → see 8 slides materialise → reorder them → reopen the deck → still there.

---

### C1 — Core Differentiators (ship after all C0 green)

| # | Title | Why YC cares | Status | Notes |
|---|---|---|---|---|
| **C1.1** | **AI Slide Copilot (Ollama + OpenRouter fallback)** | Mandatory P0 per PRD §9 | ✅ shipped (non-streaming) | `POST /api/v1/ai/generate-deck`; provider abstraction with `auto` fallback Ollama → OpenRouter → Deterministic. **SSE streaming + chat sidebar = C2 follow-up** (non-streaming POST is enough to demo). |
| **C1.2** | **Speaker-note generator** | Demo gold | ✅ shipped | `POST /api/v1/ai/speaker-notes/{slide_id}` returns notes + 3–5 likely questions; persisted. |
| **C1.3** | **Smart layout engine (rule-based + AI scoring)** | Beats raw LLM-to-HTML | ✅ shipped (5/7 layouts) | `title-only / title-bullets / section-header / quote / two-column`. **`image-right` + `chart` deferred** (need image upload + chart-data binding from C2.3 / C2.4). Heuristic runs as the critic over LLM output. |
| **C1.4** | **Brand kit (colors, fonts, logo, do/don't)** | Wedge: brand drift | ✅ shipped | Per-workspace `BrandKit`; **CSS variables `--brand-accent / --brand-primary / --brand-neutral / --brand-font-*` cascaded on `:root`** by the global `Providers`; refreshed on save. |
| **C1.5** | **Multi-format export (PDF, PPTX, HTML zip)** | Distribution moat | ✅ shipped | `reportlab` (PDF), `python-pptx` (PPTX), zipfile (HTML). Pure-Python — same on Mac/Linux/slim Docker. |
| **C1.6** | **Real-time collaboration (Yjs + websocket)** | Table stakes for B2B | ⚠️ shipped lightweight | **Presence + invalidate broadcast** via `RoomManager` over plain WebSocket. **Yjs CRDT + cursors + comments deferred to C2** — single-replica MVP for now; for multi-region we swap the in-process dict for Redis pub/sub. |
| **C1.7** | **Audience analytics (per-slide telemetry)** | Closes the loop | ✅ shipped | `POST /api/v1/presentations/{id}/analytics/event` + `GET /…/analytics/summary`; both presenter view and public share view record. Heatmap on detail page. (Path is presentation-scoped rather than `share/:token/event` — token-scoped path is a small follow-up that lets us also rate-limit per-token.) |
| **C1.8** | **Brand RAG over past decks (pgvector)** | **Defensible moat** | ✅ shipped (TF-IDF) | `BrandReference` corpus + pure-Python TF-IDF cosine in `app/services/rag.py`. **Works on SQLite *and* Postgres** with zero native deps — pgvector swap is a config flip when we have Postgres in prod. Generate-deck inlines top-3 hits + reports `references_used`. |
| **C1.9** | **Share-link with view permission + password** | Distribution | ✅ shipped | Tokenised links, PBKDF2-SHA256 password, expiry, view counter, rotate/revoke. |

---

### C2 — Advanced / Moat-Building (post-funding scope)

| # | Title | Why YC cares | Notes |
|---|---|---|---|
| **C2.1** | **Multi-agent deck generation (outliner → designer → critic → repair)** | Technical depth | LangGraph/own state machine; each agent has its own prompt + critic; visible in UI as "Slide 4 was rewritten by Designer after Critic flagged X". |
| **C2.2** | **Live presenter coaching (filler/pacing/clarity)** | Wedge: rehearsal | Browser `MediaRecorder` → Whisper streaming → real-time overlay of WPM, filler-word count, sentence clarity score. |
| **C2.3** | **AI image generation per slide** | Closes "looks generic" gap | Stable Diffusion via API (Replicate / Together / local); style locked to brand kit. |
| **C2.4** | **Data-bound slides (CSV / SQL / HTTP connectors)** | Wedge: stale decks | Charts and KPIs re-query on open; "freshness badge" per slide. |
| **C2.5** | **Interactive polls + Q&A during share-link view** | Engagement | `share/:token` page renders polls; results push live to presenter view. |
| **C2.6** | **Per-audience personalization at presentation time** | Novel wedge | Same deck, different greeting / case studies / pricing slide per recipient — chosen by a small policy LLM. |
| **C2.7** | **Accessibility autopilot (alt-text, WCAG AA contrast pass, screen-reader narration)** | Regulated buyers | Runs on every save; blocks export if AA fails. |
| **C2.8** | **Video reel export (MP4 with narration)** | Distribution | TTS speaker notes + slide-to-video pipeline (`ffmpeg`). |
| **C2.9** | **Multi-tenant + Stripe metering** | Scale | `workspace_id` already on every row from C0.2; Logto auth + Stripe metered billing on `deck.generate` events. |
| **C2.10** | **Temporal-orchestrated long jobs** | Reliability | Long generations (large RAG, video export) move to Temporal workflows with retries and progress events. |
| **C2.11** | **Embeddable deck SDK (`<dclaw-deck src=…/>`)** | Distribution moat | One-line embed in any HTML page; tracks analytics back to the workspace. |

---

## 4. Implementation Sequencing

Strict order. Each row blocks the next.

1. **Plan accepted (this file)** ✅
2. **C0.1 → C0.14** in numeric order. After C0.14: tag `v0.1-c0-complete`.
3. **C1.1, C1.2, C1.4** (Copilot + Notes + Brand kit) — first user-visible AI.
4. **C1.3 + C1.5 + C1.7** (layout, export, analytics) — demo polish.
5. **C1.6 + C1.8 + C1.9** (collab, brand-RAG, sharing) — moat layer.
6. **C2.1 → C2.11** opportunistically; C2.9 (multi-tenant + Stripe) before any pilot customer.

---

## 5. Dependencies & Architecture Notes Adopted From AGENTS.md

- All new models inherit `Base` from `app.models.base`; no `declarative_base()`.
- Never use `default_factory=` in `mapped_column()`; use `default=` with a callable.
- All datetimes naive UTC via `app.core.utils.utc_now`.
- All routes mounted under `/api/v1`. Health stays at `/health/`.
- Relationships use `lazy="selectin"`.
- Repository pattern enforced — no direct ORM use in routers.
- Frontend uses pre-built UI components in `frontend/src/components/ui/`; **no shadcn CLI install**.

---

## 6. Out-of-Scope for v1.2

- Mobile native apps (PWA only).
- On-prem self-hosting docs (Helm chart is the only deploy target).
- Marketplace for third-party themes (post-Series A).

---

## 7. Implementation Status (audit)

- **C0:** 14 / 14 shipped. All polish gaps (drag-to-reorder, toasts, version footer) closed in the polish pass.
- **C1:** 9 / 9 shipped. Three intentional scope trims, all noted inline above:
  - C1.1: SSE streaming + chat sidebar → C2 (non-streaming POST demos fine).
  - C1.6: Yjs CRDT + cursors + comments → C2 (presence + invalidate is enough to feel multi-player).
  - C1.8: pgvector swap → trigger when migrating local dev to Postgres (TF-IDF retrieval is currently equivalent for workspace-sized corpora).
  - C1.3: `image-right` + `chart` layouts → unlock once C2.3 (image gen) and C2.4 (data-bound slides) provide the missing inputs.
- **C2:** Not started — ready when funding/pilot requires.

Tests: **58 / 58 pytest green** on SQLite + Postgres; **`tsc --noEmit` clean** across 7 routes.

Subsequent bug-hunt + reliability passes added (all on top of C0/C1 spec):
- Race-recovery test for `BrandKitRepository.get_or_create` (UNIQUE collision under React StrictMode).
- `presentation_repo.list_for_workspace` rewritten to `SELECT COUNT(*)` instead of `len(list(...))` (perf at scale).
- Deterministic AI provider no longer leaks `- TODO` placeholders when `target_slides` exceeds template length (prompt-derived deep-dive slides instead).
- `/analytics/event` endpoint accepts `text/plain` JSON bodies so cross-origin `navigator.sendBeacon` dropoff events actually land (covered by 2 tests).
- WebSocket client auto-reconnects with exponential backoff (1s→30s); caller gets a `PresentationSocketHandle` to stop reconnect on unmount.
- `generate_deck()` refactored under the AGENTS 50-line limit (three helpers: `_load_or_create_deck`, `_build_enriched_prompt`, `_persist_generated_slides`).
- `ShareLinkRepository.create_safe()` catches `IntegrityError` on UNIQUE(presentation_id) and converges on the winner (covered by an async-gather race test).

---

*Plan owner: Tharuni Dayara (tharunidayara@gmail.com) — Code Manager.*
*Last revised: 2026-05-22.*
