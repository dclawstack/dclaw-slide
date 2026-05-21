from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()

VERSION = "1.0.0"


@router.get("/")
async def health_check():
    db_kind = "sqlite" if settings.database_url.startswith("sqlite") else "postgres"
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": VERSION,
        "db": db_kind,
    }
