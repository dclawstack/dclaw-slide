# DClaw Slide 🖼️

> **AI-generated decks**
>
> Presentations app in the DClaw Stack. Built with Next.js, FastAPI, PostgreSQL, and the DKube Design System.

[![Status](https://img.shields.io/badge/status-P4%20Planned-E11D48)](https://github.com/dclawstack/dclaw-slide)
[![Stack](https://img.shields.io/badge/stack-Next.js%2014%20%2B%20FastAPI%20%2B%20PostgreSQL-purple)](https://docs.dclawstack.io/apps/slide)

---

## Overview

DClaw Slide is an AI-native presentations application. It follows the standard DClaw architecture:

- **Frontend:** Next.js 14 with App Router, Tailwind CSS, React Server Components
- **Backend:** FastAPI with SQLAlchemy 2.0, Pydantic v2, asyncpg
- **Database:** PostgreSQL via CloudNativePG
- **AI:** Ollama (local) with OpenRouter fallback
- **Auth:** Logto JWT with RBAC
- **Design:** DKube Design System

---

## Design System

DClaw Slide uses the **DKube Design System** with its app-specific brand color.

| Token | Value | Usage |
|-------|-------|-------|
| Brand Color | #E11D48 | Primary actions, links |
| Surface | `#0E0E10` | Page background |
| Surface Raised | `#1F1F23` | Cards, panels |
| Body Text | `#F4F2F8` | Primary text |
| Muted | `#9E9AAB` | Secondary text |

**Fonts:** Manrope (display), Inter (body), JetBrains Mono (code)

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 15+ (or Docker)

### 1. Clone

```bash
git clone https://github.com/dclawstack/dclaw-slide.git
cd dclaw-slide
```

### 2. Backend

```bash
cd backend
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/dclaw_slide"
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Development

### Backend Structure

```
backend/
├── app/
│   ├── core/           # Config, database, auth, exceptions
│   ├── models/         # SQLAlchemy ORM
│   ├── schemas/        # Pydantic validation
│   ├── repositories/   # Data access layer
│   ├── services/       # Business logic
│   ├── api/v1/         # HTTP routers
│   └── main.py         # App factory
└── tests/
    ├── unit/           # Repository tests
    └── integration/    # API endpoint tests
```

### Run Tests

```bash
cd backend
source .venv/bin/activate
pytest --cov=app --cov-report=term-missing
```

---

## Deployment

### VPS (Recommended)

```bash
ssh root@your-vps
git clone https://github.com/dclawstack/dclaw-slide.git /opt/dclaw-slide
cd /opt/dclaw-slide
docker compose up -d
```

The app will be available at `https://slide.dclawstack.io`.

### Kubernetes

```bash
cd helm/dclaw-slide
helm dependency build
helm upgrade --install dclaw-slide . \
  --namespace dclaw-slide \
  --create-namespace
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `OLLAMA_URL` | `http://localhost:11434` | Local LLM endpoint |
| `OPENROUTER_API_KEY` | — | Cloud LLM API key |
| `LOGTO_ENDPOINT` | — | Auth server URL |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed frontend origins |

---

## Links

- [Docs](https://docs.dclawstack.io/apps/slide)
- [DPanel](https://panel.dclawstack.io)
- [DClaw Platform](https://github.com/dclawstack/dclaw-platform)
- [Design System](https://github.com/dclawstack/dclaw-platform/tree/main/design-system)

---

## License

MIT
