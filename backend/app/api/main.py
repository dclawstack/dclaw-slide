from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.api.routes import health
from app.api.v1 import (
    ai,
    analytics,
    brand_kits,
    brand_references,
    demo,
    presentations,
    share,
    themes,
    ws,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(
    presentations.router, prefix="/api/v1/presentations", tags=["presentations"]
)
app.include_router(themes.router, prefix="/api/v1/themes", tags=["themes"])
app.include_router(brand_kits.router, prefix="/api/v1/brand-kit", tags=["brand-kit"])
app.include_router(
    brand_references.router,
    prefix="/api/v1/brand-references",
    tags=["brand-references"],
)
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
app.include_router(
    analytics.router, prefix="/api/v1/presentations", tags=["analytics"]
)
# Share link: owner-side endpoints are nested under presentations; public token
# endpoint lives at /api/v1/share/{token} so the URL is short.
app.include_router(
    share.owner_router, prefix="/api/v1/presentations", tags=["share"]
)
app.include_router(share.router, prefix="/api/v1/share", tags=["share"])
app.include_router(ws.router, prefix="/api/v1/ws")
# Demo seed/clear — remove this line + app/api/v1/demo.py to delete the feature.
app.include_router(demo.router, prefix="/api/v1/demo", tags=["demo"])
