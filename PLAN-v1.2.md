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

- [ ] `frontend/package-lock.json` committed after any `npm install`
- [ ] `frontend/next-env.d.ts` exists and is committed
- [ ] `docker-compose.yml` healthchecks correct, container ports match `EXPOSE`/`ENV PORT`
- [ ] `frontend/Dockerfile` declares `ARG NEXT_PUBLIC_API_URL` before `RUN npm run build`
- [ ] `backend/tests/conftest.py` keeps `localhost:5432` for the CI Postgres service
- [ ] `pytest-asyncio==0.24.0` pinned
- [ ] Local dev SQLite (`backend/dclaw_slide.db`) is gitignored
- [ ] All models inherit `Base` from `app.models.base`
- [ ] All routers behind `/api/v1`; health stays at `/health/`

---

## 3. Roadmap

### C0 — Foundational (ship now, in order)

| # | Title | Layer | Notes |
|---|---|---|---|
| **C0.1** | **SQLite local dev DB + dual-driver config** | Backend | `aiosqlite` added; `DATABASE_URL` auto-detects sqlite vs. postgres; CI stays on Postgres; local default is `sqlite+aiosqlite:///./dclaw_slide.db`. |
| **C0.2** | **`Presentation` + `Slide` models** | Backend | SQLAlchemy 2.0 `Mapped[...]`, `Uuid` PK, ordered `slides` relationship (`order_by="Slide.position"`, `cascade="all, delete-orphan"`, `lazy="selectin"`). `workspace_id` field reserved for multi-tenant (string default `"default"`). |
| **C0.3** | **Repositories + Pydantic v2 schemas** | Backend | `PresentationRepository`, `SlideRepository` on top of `BaseRepository`; `PresentationCreate / Read / Update`, `SlideCreate / Read / Update`. `ConfigDict(from_attributes=True)`. |
| **C0.4** | **`/api/v1/presentations` CRUD + nested slides** | Backend | List/create/get/update/delete presentation; list/create/update/reorder/delete slide; wire into `app/api/main.py`. Replaces the mock `slide.py`. |
| **C0.5** | **Theme registry** | Backend | Hard-coded curated theme presets (`pitch-classic`, `pitch-bold`, `report-minimal`, `training-warm`, `dark-investor`) returned by `GET /api/v1/themes`. Each theme: id, name, accent color, font pair, deck cover preview. |
| **C0.6** | **Markdown-outline parser → slides** | Backend | Pure-Python, no LLM. `POST /api/v1/presentations/{id}/outline` accepts markdown (`# Slide title\n- bullet\n- bullet\n## subtitle …`) and creates ordered slides. Deterministic, fast, testable. |
| **C0.7** | **Slide reorder endpoint** | Backend | `POST /api/v1/presentations/{id}/slides/reorder` accepts `[slide_id, …]`, updates `position`. |
| **C0.8** | **Dashboard wired to real API** | Frontend | `/dashboard` lists presentations from `/api/v1/presentations`, "Create" button posts a real presentation, navigates to detail. |
| **C0.9** | **Presentation detail + slide viewer/editor** | Frontend | `/p/[id]`: editable title, slide list with inline edit (title + bullets), drag-to-reorder, "Paste outline" textarea calling `C0.6`. |
| **C0.10** | **Typed API client + error toasts** | Frontend | `src/lib/api.ts` typed functions for every C0 endpoint, single `ApiError` surface, simple toast on failure. |
| **C0.11** | **Health + version endpoint** | Backend | `/health/` returns `{status, app, version, db}`; used by Docker healthcheck and `<footer>` in UI. |
| **C0.12** | **Backend tests for C0 surface** | Backend | One pytest per CRUD route + outline parser unit tests; uses existing `client` fixture; runs on SQLite locally and Postgres in CI. |
| **C0.13** | **`dclaw-manifest.json`** | Frontend | `frontend/public/dclaw-manifest.json` for DPanel registration (fills PRD gap #1). |
| **C0.14** | **`.gitignore` for local SQLite + `.next/`** | Repo | Ensure `*.db`, `*.db-journal`, `.next/`, `__pycache__/` are ignored. |

**C0 demo script:** open `http://localhost:3021/dashboard` → create "Series A Pitch" → paste a markdown outline → see 8 slides materialise → reorder them → reopen the deck → still there.

---

### C1 — Core Differentiators (ship after all C0 green)

| # | Title | Why YC cares | Notes |
|---|---|---|---|
| **C1.1** | **AI Slide Copilot (Ollama + OpenRouter fallback)** | Mandatory P0 per PRD §9 | `POST /api/v1/ai/generate-deck` streaming SSE. Local Ollama by default; auto-fall back to OpenRouter (`OPENROUTER_API_KEY` set) — never throw if cloud is unavailable. Frontend right-rail chat. |
| **C1.2** | **Speaker-note generator** | Demo gold | `POST /api/v1/ai/speaker-notes/{slide_id}`; per-slide notes + 5 likely audience questions. |
| **C1.3** | **Smart layout engine (rule-based + AI scoring)** | Beats raw LLM-to-HTML | Heuristic layout picker (title-only, two-column, image-right, quote, chart) + AI critic that rescues bad picks. |
| **C1.4** | **Brand kit (colors, fonts, logo, do/don't)** | Wedge: brand drift | Per-workspace brand kit JSON; applied as Tailwind CSS variables at render time. |
| **C1.5** | **Multi-format export (PDF, PPTX, HTML zip)** | Distribution moat | Backend export pipeline (`python-pptx`, `weasyprint`/`playwright`). One-click in UI. |
| **C1.6** | **Real-time collaboration (Yjs + websocket)** | Table stakes for B2B | Multi-user cursors, comments, presence; conflict resolution via Yjs awareness. |
| **C1.7** | **Audience analytics (per-slide telemetry)** | Closes the loop | `POST /api/v1/share/:token/event` (`slide_view`, `dwell_ms`, `dropoff`); heatmap dashboard. |
| **C1.8** | **Brand RAG over past decks (pgvector)** | **Defensible moat** | Upload N past decks → embed every slide → at generation time, retrieve closest brand exemplars and condition the LLM on them. **This is the moat.** |
| **C1.9** | **Share-link with view permission + password** | Distribution | Tokenised public links, optional password, expiry. |

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

*Plan owner: Tharuni Dayara (tharunidayara@gmail.com) — Code Manager.*
*Last revised: 2026-05-21.*
