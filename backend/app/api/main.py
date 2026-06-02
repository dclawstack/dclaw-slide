import os
import uuid
from contextlib import asynccontextmanager

import sentry_sdk
import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.core.logging import configure_logging
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


configure_logging()
log = structlog.get_logger(__name__)

if os.environ.get("SENTRY_DSN"):
    sentry_sdk.init(
        dsn=os.environ["SENTRY_DSN"],
        traces_sample_rate=0.1,
        environment=settings.app_env,
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

# Rate limiting (slowapi)
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Response compression
app.add_middleware(GZipMiddleware, minimum_size=500)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.get("/health")
async def health_root(request: Request):
    from fastapi.responses import JSONResponse

    response = JSONResponse({"status": "ok"})
    response.headers["Cache-Control"] = "public, max-age=30"
    return response

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
