from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.api.routes import health
from app.api.v1 import ai, brand_kits, presentations, themes


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
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
