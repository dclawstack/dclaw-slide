# DClaw Slide — v1.2 Feature Roadmap

> Based on: Y Combinator vertical SaaS principles, trending GitHub repos (slidev, reveal.js), AI product research (Gamma, Tome, Beautiful.ai, Pitch)

## Pre-Flight Checklist

- [ ] `frontend/package-lock.json` committed after any `npm install` / dependency change
- [ ] `frontend/next-env.d.ts` exists and is committed
- [ ] `docker-compose.yml` healthchecks correct
- [ ] `frontend/Dockerfile` declares `ARG NEXT_PUBLIC_API_URL` before `RUN npm run build`

## v1.0 Feature Inventory (Current)

- [ ] Presentation CRUD
- [ ] Slide editor
- [ ] Theme library
- [ ] Basic presenter view
- [ ] Real backend CRUD (no mocks)
- [ ] Docker + Helm deployment
- [ ] Alembic migrations
- [ ] Backend tests

---

## v1.2 Roadmap

### P0 — Must Have (Ship in v1.0, demo-ready)

#### 1. AI Slide Copilot (Presentation Designer)
**Description:** AI assistant that generates entire presentations from outlines, suggests layouts, and writes speaker notes. "Create a 10-slide pitch deck for our SaaS product."
- **AI Angle:** Outline-to-slides generation. Layout suggestion. Speaker note generation.
- **Backend:** `/api/v1/ai/slide-chat` endpoint. Slide generation pipeline.
- **Frontend:** Chat panel with generated slide previews. One-click insert.
- **Files:** `backend/app/services/slide_ai.py`, `frontend/src/components/slide-copilot.tsx`

#### 2. Smart Layout Engine
**Description:** Auto-layout content with professional design rules. Responsive to content changes.
- **Backend:** Layout engine with design constraints.
- **Frontend:** Drag-and-drop editor with smart snap and resize.
- **Files:** `frontend/src/app/editor/layout-engine.tsx`

#### 3. Theme & Brand System
**Description:** Custom themes with fonts, colors, logos. Lock brand elements across all decks.
- **Backend:** Theme persistence. Brand asset management.
- **Frontend:** Theme editor with live preview. Brand kit panel.
- **Files:** `backend/app/services/themes.py`

#### 4. Real-Time Collaboration
**Description:** Multi-user editing with live cursors, comments, and version history.
- **Backend:** Operational transform sync server.
- **Frontend:** Collaborative editor with user presence.
- **Files:** `backend/app/services/collaboration.py`

### P1 — Should Have (v1.1–1.2)

#### 5. AI Image & Chart Generation
**Description:** Generate images and charts from text descriptions within slides.
- **AI Angle:** DALL-E/Midjourney integration for images. Chart data parsing.
- **Backend:** Image generation pipeline. Chart rendering API.
- **Frontend:** Image/chart generator modal.

#### 6. Data-Driven Slides
**Description:** Connect slides to live data sources. Auto-update charts and KPIs.
- **Backend:** Data connector framework. Refresh scheduler.
- **Frontend:** Data binding UI with preview.

#### 7. Presentation Analytics
**Description:** Track time spent per slide, audience engagement, drop-off points.
- **Backend:** Analytics ingestion from presenter sessions.
- **Frontend:** Analytics dashboard with heatmap.

#### 8. Export & Sharing
**Description:** Export to PDF, PPTX, HTML. Share with view/comment/edit permissions.
- **Backend:** Export pipeline with format conversion.
- **Frontend:** Export dialog. Share settings.

### P2 — Could Have (v1.3+)

#### 9. AI Speaker Coach
**Description:** AI analyzes rehearsal recordings and gives feedback on pace, filler words, and clarity.

#### 10. Interactive Polls & Q&A
**Description:** Embed live polls, quizzes, and Q&A in presentations.

#### 11. 3D & Animation Effects
**Description:** Advanced transitions, 3D elements, and cinematic animations.

#### 12. AI-Generated Handouts
**Description:** Auto-generate speaker notes, handouts, and follow-up emails from presentation content.

---

## Implementation Priority

1. **Week 1–2:** AI Slide Copilot (P0.1) + Smart Layout Engine (P0.2)
2. **Week 3–4:** Theme System (P0.3) + Collaboration (P0.4)
3. **Week 5–6:** AI Image/Chart Generation (P1.5) + Data-Driven Slides (P1.6)
4. **Week 7–8:** Presentation Analytics (P1.7) + Export/Sharing (P1.8)
